import { useEffect, useState } from "react";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import type { Guest, PrepSection } from "shared";

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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function fromDoc(id: string, data: DocumentData): MealPlan {
  return {
    id,
    ownerId: data.ownerId,
    name: data.name ?? "",
    notes: (data.notes as string | undefined) || undefined,
    guests: Array.isArray(data.guests) ? (data.guests as Guest[]) : [],
    recipeIds: Array.isArray(data.recipeIds)
      ? (data.recipeIds as string[])
      : [],
    // prepSections is back-compat optional — old docs predate the field
    // and read as an empty list so the UI doesn't have to special-case
    // missing data.
    prepSections: Array.isArray(data.prepSections)
      ? (data.prepSections as PrepSection[])
      : [],
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
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
    const unsub = onSnapshot(
      query(
        collection(db, "mealPlans"),
        where("ownerId", "==", uid),
        orderBy("createdAt", "desc"),
      ),
      (snap) => {
        setPlans(snap.docs.map((d) => fromDoc(d.id, d.data())));
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

/**
 * Generate a stable, client-side id. Used by the guest list and prep
 * list editors so React keys + delete-by-id work without index churn
 * when entries are added or removed. Falls back to a timestamp +
 * random suffix if `crypto.randomUUID` isn't available (older Safari).
 */
function newClientId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const newGuestId = newClientId;
export const newPrepId = newClientId;
