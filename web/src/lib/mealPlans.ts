import { useEffect, useState } from "react";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { DocumentData, Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type {
  AdditionalItem,
  GuestGroup,
  GroceryList,
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
  guests: GuestGroup[];
  recipeIds: string[];
  /** Prep notes as markdown — headers, bullets, numbered + task
   *  lists, bold/italic, links. Empty string when nothing's been
   *  written. Replaces the older structured prepSections shape;
   *  legacy values are converted on read inside the parser. */
  prepNotes: string;
  /** Non-recipe menu lines — store-bought items, contributions from
   *  guests, drinks. Always present; defaults to [] on old docs that
   *  predate the field. */
  additionalItems: AdditionalItem[];
  /** ISO date (YYYY-MM-DD) for the meal occasion. Optional on older plans. */
  date?: string;
  /**
   * UIDs the owner explicitly granted view access to. Always present;
   * defaults to [] on read for back-compat with plans created before
   * sharing shipped. Mirrors the recipe sharedWith pattern.
   */
  sharedWith: string[];
  /**
   * Denormalized {uid, email} mirror so the share dialog can render
   * who has access without a separate Auth lookup per render.
   */
  sharedWithDetails: { uid: string; email: string }[];
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
  /**
   * How this plan became visible to the current user:
   *   "owned"   — the user is the plan's owner
   *   "shared"  — owner added them to sharedWith
   *   "auto"    — owner granted blanket access via autoShares
   * Multiple sources can apply; we pick the strongest (owned >
   * shared > auto) so the list UI can render a single badge.
   * Only meaningful in list contexts (useMealPlans / useSharedPlans);
   * single-doc reads via useMealPlan set this based on the snapshot.
   */
  access: "owned" | "shared" | "auto";
};

/**
 * Reverse-chronological sort key for a plan in the index list.
 *
 * Returns an epoch-millis number, larger = sort earlier (newest first):
 *
 *   1. If the plan has a meal `date` ("YYYY-MM-DD"), use that. A
 *      future Thanksgiving 2026 plan ranks above last week's random
 *      Tuesday dinner; a past Thanksgiving 2020 plan ranks below
 *      anything happening more recently.
 *   2. Otherwise fall back to `createdAt`. Plans the user never put a
 *      date on still slot in by when they were created.
 *   3. Pending writes (no resolved `createdAt`) get `+Infinity` so a
 *      brand-new plan jumps to the top while the server stamps the
 *      timestamp.
 *
 * ISO dates are parsed at UTC midnight — the absolute epoch doesn't
 * matter for sort comparisons; consistency does, and UTC avoids DST
 * weirdness on the boundary days.
 */
function planSortKey(plan: MealPlan): number {
  if (plan.date) {
    const parts = plan.date.split("-").map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const [y, m, d] = parts;
      return Date.UTC(y, m - 1, d);
    }
  }
  return plan.createdAt?.toMillis() ?? Number.POSITIVE_INFINITY;
}

function fromDoc(
  id: string,
  data: DocumentData,
  access: MealPlan["access"],
): MealPlan {
  // Pure parsing + back-compat lives in mealPlansCore so it can be
  // unit-tested without the firebase SDK. We re-attach the Firestore
  // Timestamp types on the way out — parseMealPlanDoc keeps timestamps
  // as `unknown` because it has no firebase types in scope.
  const parsed = parseMealPlanDoc(id, data as Record<string, unknown>);
  return {
    ...parsed,
    access,
    createdAt: parsed.createdAt as Timestamp | undefined,
    updatedAt: parsed.updatedAt as Timestamp | undefined,
    groceryListGeneratedAt: parsed.groceryListGeneratedAt as
      | Timestamp
      | undefined,
  };
}

/**
 * Live list of every meal plan owned by `uid`, sorted reverse-
 * chronologically by meal date (with createdAt as a fallback for
 * plans that don't have a date set). See {@link planSortKey} for
 * the exact ordering rule.
 */
export function useMealPlans(uid: string | undefined): {
  plans: MealPlan[];
  loading: boolean;
} {
  // Three independent maps so a snapshot from one query doesn't
  // clobber the others (identical pattern to useRecipeList).
  const [owned, setOwned] = useState<Map<string, MealPlan>>(new Map());
  const [shared, setShared] = useState<Map<string, MealPlan>>(new Map());
  const [auto, setAuto] = useState<Map<string, MealPlan>>(new Map());
  const [ownedReady, setOwnedReady] = useState(false);
  const [sharedReady, setSharedReady] = useState(false);
  const [autoReady, setAutoReady] = useState(false);

  // Owned + explicit-share subscriptions are stable for the lifetime
  // of uid. We avoid `orderBy("createdAt")` here on purpose — pairing
  // it with serverTimestamp() pending writes used to trip the
  // IndexedDB-backed listener with an SDK assertion (`b815 / ve:-1`).
  // Sort client-side via planSortKey instead.
  useEffect(() => {
    if (!uid) {
      setOwned(new Map());
      setShared(new Map());
      setOwnedReady(false);
      setSharedReady(false);
      return;
    }

    const unsubOwned = onSnapshot(
      query(collection(db, "mealPlans"), where("ownerId", "==", uid)),
      (snap) => {
        const m = new Map<string, MealPlan>();
        for (const d of snap.docs) m.set(d.id, fromDoc(d.id, d.data(), "owned"));
        setOwned(m);
        setOwnedReady(true);
      },
      (err) => {
        console.error("owned meal plans:", err);
        setOwnedReady(true);
      },
    );

    const unsubShared = onSnapshot(
      query(
        collection(db, "mealPlans"),
        where("sharedWith", "array-contains", uid),
      ),
      (snap) => {
        const m = new Map<string, MealPlan>();
        for (const d of snap.docs) m.set(d.id, fromDoc(d.id, d.data(), "shared"));
        setShared(m);
        setSharedReady(true);
      },
      (err) => {
        console.error("shared meal plans:", err);
        setSharedReady(true);
      },
    );

    return () => {
      unsubOwned();
      unsubShared();
    };
  }, [uid]);

  // Auto-share fan-out: subscribe to the autoShares pointing at me,
  // then for each one open a mealPlans-where-ownerId-equals
  // subscription. Mirror of useRecipeList's auto-share fan-out so the
  // single autoShare grant covers both surfaces — that's why the user
  // wanted them unified.
  useEffect(() => {
    if (!uid) {
      setAuto(new Map());
      setAutoReady(false);
      return;
    }

    const innerSubs = new Map<string, Unsubscribe>();
    const perOwner = new Map<string, Map<string, MealPlan>>();

    function recomputeAuto() {
      const merged = new Map<string, MealPlan>();
      for (const ownerMap of perOwner.values()) {
        for (const [id, plan] of ownerMap) merged.set(id, plan);
      }
      setAuto(merged);
    }

    const unsubOuter = onSnapshot(
      query(collection(db, "autoShares"), where("granteeUid", "==", uid)),
      (snap) => {
        const currentOwners = new Set<string>();
        snap.docs.forEach((d) => {
          const ownerId = (d.data() as { ownerId: string }).ownerId;
          currentOwners.add(ownerId);
          if (innerSubs.has(ownerId)) return;
          const inner = onSnapshot(
            query(
              collection(db, "mealPlans"),
              where("ownerId", "==", ownerId),
            ),
            (innerSnap) => {
              const m = new Map<string, MealPlan>();
              for (const d of innerSnap.docs) {
                m.set(d.id, fromDoc(d.id, d.data(), "auto"));
              }
              perOwner.set(ownerId, m);
              recomputeAuto();
              setAutoReady(true);
            },
            (err) => {
              console.error("auto-shared meal plans:", err);
              setAutoReady(true);
            },
          );
          innerSubs.set(ownerId, inner);
        });
        // Tear down subs for revoked autoShares.
        for (const [ownerId, unsub] of innerSubs) {
          if (!currentOwners.has(ownerId)) {
            unsub();
            innerSubs.delete(ownerId);
            perOwner.delete(ownerId);
          }
        }
        if (snap.size === 0) {
          setAuto(new Map());
          setAutoReady(true);
        } else {
          recomputeAuto();
        }
      },
      (err) => {
        console.error("autoShares list:", err);
        setAutoReady(true);
      },
    );

    return () => {
      unsubOuter();
      for (const unsub of innerSubs.values()) unsub();
    };
  }, [uid]);

  // Merge owned > shared > auto so a plan that's both explicitly
  // shared AND auto-shared shows as "shared" (the more specific
  // signal). Sort by planSortKey at the end so the unified list is
  // reverse-chronological by meal date.
  const seen = new Set<string>();
  const merged: MealPlan[] = [];
  for (const map of [owned, shared, auto]) {
    for (const item of map.values()) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  merged.sort((a, b) => planSortKey(b) - planSortKey(a));

  return {
    plans: merged,
    loading: !(ownedReady && sharedReady && autoReady),
  };
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
          const data = snap.data();
          // Derive access from the snapshot: owner if ownerId matches,
          // shared if I'm in sharedWith, otherwise auto (the only
          // remaining read path the rules allow). Pages that need to
          // gate owner-only UI (Share/Edit/Delete buttons) read this.
          const access: MealPlan["access"] =
            data.ownerId === uid
              ? "owned"
              : Array.isArray(data.sharedWith) && data.sharedWith.includes(uid)
                ? "shared"
                : "auto";
          setPlan(fromDoc(snap.id, data, access));
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
    // Seed share fields explicitly so the rule's
    // `request.auth.uid in resource.data.sharedWith` check never
    // trips on a missing field. New plans start owner-only.
    sharedWith: [],
    sharedWithDetails: [],
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
    guests?: GuestGroup[];
    prepNotes?: string;
    additionalItems?: AdditionalItem[];
    date?: string;
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
  if (patch.prepNotes !== undefined) {
    update.prepNotes = patch.prepNotes;
  }
  if (patch.additionalItems !== undefined) {
    update.additionalItems = patch.additionalItems;
  }
  if (patch.date !== undefined) {
    // Empty string means the user cleared the date — remove the field.
    update.date = patch.date || deleteField();
  }
  await updateDoc(doc(db, "mealPlans", id), update);
}

export async function deleteMealPlan(id: string): Promise<void> {
  await deleteDoc(doc(db, "mealPlans", id));
}

/**
 * Clone a meal plan into a new doc owned by `uid` under a new name.
 *
 * What carries over from the source:
 *   - recipeIds, additionalItems, prepNotes, notes — the menu and
 *     planning structure the user wants to reuse for a similar
 *     occasion.
 *
 * What gets cleared (so each occasion starts fresh):
 *   - guests — every party has its own headcount
 *   - date — the duplicate is for a different day by definition
 *   - groceryList / groceryListGeneratedAt — derived from recipes; we
 *     don't carry over the cached version because the user will edit
 *     the plan before they need it. Next click of "Generate" rebuilds.
 *
 * Returns the new doc id so the caller can route the user straight
 * into editing the duplicate.
 */
export async function duplicateMealPlan(
  source: MealPlan,
  newName: string,
  uid: string,
): Promise<string> {
  const name = trimOrEmpty(newName, 200, "Meal plan name");
  // Firestore's `ignoreUndefinedProperties` setting on the client
  // (see lib/firebase.ts) drops undefined fields cleanly, so we can
  // pass `undefined` for optional carry-overs without polluting the
  // doc with nulls.
  const ref = await addDoc(collection(db, "mealPlans"), {
    ownerId: uid,
    name,
    notes: source.notes,
    guests: [],
    recipeIds: [...source.recipeIds],
    prepNotes: source.prepNotes,
    additionalItems: source.additionalItems.map((item) => ({ ...item })),
    // date intentionally omitted — see jsdoc above.
    // Shares DON'T carry over either: a duplicate is a new plan for a
    // new occasion. The original's collaborators don't automatically
    // get access to the copy; the duplicating user re-shares if they
    // want them on the new plan.
    sharedWith: [],
    sharedWithDetails: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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
