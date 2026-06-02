import { useEffect, useState } from "react";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type {
  AdditionalItem,
  Guest,
  GroceryList,
  PrepSection,
} from "shared";
import { newClientId, parseMealPlanDoc } from "./mealPlansCore";

/**
 * Stored meal-plan shape. Mirrors the recipes/{id} convention: ownerId
 * stamped on every doc, createdAt/updatedAt as server timestamps. Title
 * resolution happens at render time against the live recipe stream, so
 * the plan only stores recipe ids.
 */
export type MealPlan = {
  id: string;
  ownerId: string;
  name: string;
  notes?: string;
  guests: Guest[];
  recipeIds: string[];
  prepSections: PrepSection[];
  /** Non-recipe menu lines — store-bought items, contributions from
   *  guests, drinks. Always present; defaults to [] on old docs that
   *  predate the field. */
  additionalItems: AdditionalItem[];
  /** Cached grocery list from the last generation. Absent until the
   *  user generates one. Mirrored back to Firestore by the Cloud
   *  Function so a reload of the plan picks it up from the snapshot. */
  groceryList?: GroceryList;
  /** Server timestamp set by the Cloud Function on each generation.
   *  Compared against the plan's `updatedAt` so the UI can flag the
   *  list as stale when recipes change after generation. */
  groceryListGeneratedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function fromDoc(id: string, data: DocumentData): MealPlan {
  // Pure parsing + back-compat lives in mealPlansCore so it can be
  // unit-tested without the firebase SDK. We re-attach the Firestore
  // Timestamp types on the way out — parseMealPlanDoc keeps timestamps
  // as `unknown` because it has no firebase types in scope.
  const parsed = parseMealPlanDoc(id, data as Record<string, unknown>);
  return {
    ...parsed,
    createdAt: parsed.createdAt as Timestamp | undefined,
    updatedAt: parsed.updatedAt as Timestamp | undefined,
    groceryListGeneratedAt: parsed.groceryListGeneratedAt as
      | Timestamp
      | undefined,
  };
}

/**
 * Live list of every meal plan owned by `uid`, newest first.
 */
export function useMealPlans(uid: string | undefined): {
  plans: MealPlan[];
  loading: boolean;
} {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Filter server-side, sort CLIENT-side. Adding `orderBy("createdAt")`
    // here interacts badly with the `serverTimestamp()` we stamp on
    // create — the client sees a pending null for that field until the
    // server acknowledges, and the IndexedDB-backed listener trips an
    // SDK assertion (`b815 / ve:-1`) trying to position the pending
    // doc against itself in the order. Sorting client-side dodges the
    // race entirely; meal plans are low cardinality so the in-memory
    // sort is free.
    const unsub = onSnapshot(
      query(collection(db, "mealPlans"), where("ownerId", "==", uid)),
      (snap) => {
        const next = snap.docs.map((d) => fromDoc(d.id, d.data()));
        next.sort((a, b) => {
          // Docs without a resolved createdAt (write-in-flight) sort
          // to the top — they're the newest by definition.
          const aMs = a.createdAt?.toMillis() ?? Number.POSITIVE_INFINITY;
          const bMs = b.createdAt?.toMillis() ?? Number.POSITIVE_INFINITY;
          return bMs - aMs;
        });
        setPlans(next);
        setLoading(false);
      },
      (err) => {
        console.error("Meal plans snapshot:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  return { plans, loading };
}

/**
 * Live subscription to a single meal plan. Returns `null` on the doc
 * not existing (or being inaccessible — security rules block reads on
 * plans the user doesn't own).
 */
export function useMealPlan(
  uid: string | undefined,
  id: string | undefined,
): { plan: MealPlan | null; loading: boolean; error: string | null } {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !id) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      doc(db, "mealPlans", id),
      (snap) => {
        if (snap.exists()) {
          setPlan(fromDoc(snap.id, snap.data()));
          setError(null);
        } else {
          setPlan(null);
          setError("Meal plan not found.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Meal plan snapshot:", err);
        setError(err instanceof Error ? err.message : "Failed to load.");
        setLoading(false);
      },
    );
    return unsub;
  }, [uid, id]);

  return { plan, loading, error };
}

function trimOrEmpty(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} cannot be empty.`);
  if (trimmed.length > max) throw new Error(`${label} is too long.`);
  return trimmed;
}

/**
 * Create a meal plan with just the name set. Returns the new doc id so
 * the caller can navigate straight to the detail page for editing.
 */
export async function createMealPlan(
  uid: string,
  rawName: string,
): Promise<string> {
  const name = trimOrEmpty(rawName, 200, "Meal plan name");
  const ref = await addDoc(collection(db, "mealPlans"), {
    ownerId: uid,
    name,
    guests: [],
    recipeIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameMealPlan(
  id: string,
  rawName: string,
): Promise<void> {
  const name = trimOrEmpty(rawName, 200, "Meal plan name");
  await updateDoc(doc(db, "mealPlans", id), {
    name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update mutable metadata in one shot. Pass only the fields you're
 * changing — undefined values are dropped so callers don't have to
 * read-modify-write the whole doc.
 */
export async function updateMealPlanMeta(
  id: string,
  patch: {
    notes?: string;
    guests?: Guest[];
    prepSections?: PrepSection[];
    additionalItems?: AdditionalItem[];
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.notes !== undefined) {
    // Empty string clears the field; the rules don't require notes.
    update.notes = patch.notes.trim();
  }
  if (patch.guests !== undefined) {
    update.guests = patch.guests;
  }
  if (patch.prepSections !== undefined) {
    update.prepSections = patch.prepSections;
  }
  if (patch.additionalItems !== undefined) {
    update.additionalItems = patch.additionalItems;
  }
  await updateDoc(doc(db, "mealPlans", id), update);
}

export async function deleteMealPlan(id: string): Promise<void> {
  await deleteDoc(doc(db, "mealPlans", id));
}

/**
 * Append a recipe to a plan. arrayUnion dedupes — adding a recipe that
 * the plan already contains is a no-op rather than an error, which is
 * the UX the add-to-plan dialog wants (idempotent clicks).
 */
export async function addRecipeToMealPlan(
  planId: string,
  recipeId: string,
): Promise<void> {
  await updateDoc(doc(db, "mealPlans", planId), {
    recipeIds: arrayUnion(recipeId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeRecipeFromMealPlan(
  planId: string,
  recipeId: string,
): Promise<void> {
  await updateDoc(doc(db, "mealPlans", planId), {
    recipeIds: arrayRemove(recipeId),
    updatedAt: serverTimestamp(),
  });
}

// Re-export the id helper from the pure-helpers module under the names
// the UI uses at call sites. Same implementation behind both — see
// mealPlansCore.newClientId for the rationale.
export const newGuestId = newClientId;
export const newPrepId = newClientId;

/**
 * Call the generateGroceryList Cloud Function for the given plan.
 * The function fetches the plan's recipes, runs them through Claude
 * for consolidation + categorization, writes the result onto the
 * plan doc (so the live snapshot updates automatically), and also
 * returns it here for the caller's convenience.
 *
 * Throws on auth / permission / server errors with the HttpsError
 * message — the caller surfaces it to the user.
 */
export async function generateGroceryList(planId: string): Promise<GroceryList> {
  const call = httpsCallable<{ planId: string }, GroceryList>(
    functions,
    "generateGroceryList",
  );
  const result = await call({ planId });
  return result.data;
}
