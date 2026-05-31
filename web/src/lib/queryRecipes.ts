import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type {
  DocumentData,
  QuerySnapshot,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export type RecipeListItem = {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  tags: string[];
  searchTokens: string[];
  totalTime?: string;
  photoUrl?: string;
  /** 1–5, present when the user has rated the recipe. */
  rating?: number;
  /** ISO YYYY-MM-DD, present when the user has logged a cook date. */
  lastMadeDate?: string;
  createdAt?: Timestamp;
  /**
   * How this recipe became visible to the current user:
   *   "owned"   - the user is the recipe's owner
   *   "shared"  - the owner explicitly added them to sharedWith
   *   "auto"    - the owner granted them blanket access via autoShares
   * Multiple sources can apply to the same recipe — we pick the strongest
   * (owned > shared > auto) so list rendering can decide what badge to show.
   */
  access: "owned" | "shared" | "auto";
};

function summarize(
  d: DocumentData,
  id: string,
  access: RecipeListItem["access"],
): RecipeListItem {
  return {
    id,
    ownerId: d.ownerId,
    title: d.title,
    category: d.category,
    tags: d.tags ?? [],
    searchTokens: d.searchTokens ?? [],
    totalTime: d.totalTime as string | undefined,
    photoUrl: d.photoUrl as string | undefined,
    rating: d.rating as number | undefined,
    lastMadeDate: d.lastMadeDate as string | undefined,
    createdAt: d.createdAt as Timestamp | undefined,
    access,
  };
}

/**
 * Listen for every recipe visible to `uid` via three concurrent queries
 * (Firestore can't OR across collections, so we fan out and merge in
 * memory):
 *
 *   1. recipes where ownerId == uid                   → owned
 *   2. recipes where sharedWith array-contains uid    → explicit shares
 *   3. for each autoShares doc with granteeUid==uid:
 *      recipes where ownerId == autoShare.ownerId    → blanket grants
 *
 * Each query has its own onSnapshot subscription so updates flow in
 * real-time. The merge dedupes by recipe id and picks the strongest
 * access label (owned > shared > auto) so the UI can render a single
 * source-of-truth badge per recipe.
 *
 * Returns `{ recipes, loading }`. `loading` flips to false the first
 * time every active subscription has reported at least once — including
 * the auto-share fan-out, which can be 0..N subqueries.
 */
export function useRecipeList(uid: string | undefined): {
  recipes: RecipeListItem[];
  loading: boolean;
} {
  // Three independent maps so a snapshot from one query doesn't clobber
  // the others. Final merge happens in a derived useEffect.
  const [owned, setOwned] = useState<Map<string, RecipeListItem>>(new Map());
  const [shared, setShared] = useState<Map<string, RecipeListItem>>(new Map());
  const [auto, setAuto] = useState<Map<string, RecipeListItem>>(new Map());
  const [ownedReady, setOwnedReady] = useState(false);
  const [sharedReady, setSharedReady] = useState(false);
  const [autoReady, setAutoReady] = useState(false);

  // Owned + explicit-share subscriptions are stable for the lifetime of uid.
  useEffect(() => {
    if (!uid) {
      setOwned(new Map());
      setShared(new Map());
      setOwnedReady(false);
      setSharedReady(false);
      return;
    }

    const unsubOwned = onSnapshot(
      query(
        collection(db, "recipes"),
        where("ownerId", "==", uid),
        orderBy("updatedAt", "desc"),
      ),
      (snap) => {
        setOwned(snapToMap(snap, "owned"));
        setOwnedReady(true);
      },
      (err) => {
        console.error("owned recipes:", err);
        setOwnedReady(true);
      },
    );

    const unsubShared = onSnapshot(
      query(
        collection(db, "recipes"),
        where("sharedWith", "array-contains", uid),
        orderBy("updatedAt", "desc"),
      ),
      (snap) => {
        setShared(snapToMap(snap, "shared"));
        setSharedReady(true);
      },
      (err) => {
        console.error("shared recipes:", err);
        setSharedReady(true);
      },
    );

    return () => {
      unsubOwned();
      unsubShared();
    };
  }, [uid]);

  // Auto-share fan-out: subscribe to the autoShares pointing at me, then
  // for each one open a recipes-where-ownerId-equals subscription. The
  // inner subs live and die with their parent autoShare doc.
  useEffect(() => {
    if (!uid) {
      setAuto(new Map());
      setAutoReady(false);
      return;
    }

    // Map of ownerId → unsubscribe, so we can tear individual subs down
    // when an autoShare is revoked without restarting the others.
    const innerSubs = new Map<string, Unsubscribe>();
    // Each owner has its own recipe map; we merge them into `auto` after
    // any inner snapshot fires.
    const perOwner = new Map<string, Map<string, RecipeListItem>>();

    function recomputeAuto() {
      const merged = new Map<string, RecipeListItem>();
      for (const ownerMap of perOwner.values()) {
        for (const [id, recipe] of ownerMap) merged.set(id, recipe);
      }
      setAuto(merged);
    }

    const unsubOuter = onSnapshot(
      query(
        collection(db, "autoShares"),
        where("granteeUid", "==", uid),
      ),
      (snap) => {
        const currentOwners = new Set<string>();
        snap.docs.forEach((d) => {
          const ownerId = (d.data() as { ownerId: string }).ownerId;
          currentOwners.add(ownerId);
          if (innerSubs.has(ownerId)) return;
          // New owner — open a subscription for their recipes.
          const inner = onSnapshot(
            query(
              collection(db, "recipes"),
              where("ownerId", "==", ownerId),
            ),
            (innerSnap) => {
              perOwner.set(ownerId, snapToMap(innerSnap, "auto"));
              recomputeAuto();
              setAutoReady(true);
            },
            (err) => {
              console.error("auto-shared recipes:", err);
              setAutoReady(true);
            },
          );
          innerSubs.set(ownerId, inner);
        });
        // Tear down subs for autoShares that were revoked.
        for (const [ownerId, unsub] of innerSubs) {
          if (!currentOwners.has(ownerId)) {
            unsub();
            innerSubs.delete(ownerId);
            perOwner.delete(ownerId);
          }
        }
        // If there are zero auto-shares we're "ready" immediately.
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

  // Merge with owned > shared > auto precedence so a recipe that's both
  // explicitly shared AND auto-shared shows as "shared" (the more
  // specific signal). Sort by createdAt desc so newer recipes float up
  // even across the three sources.
  const merged: RecipeListItem[] = [];
  const seen = new Set<string>();
  for (const map of [owned, shared, auto]) {
    for (const item of map.values()) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }

  return {
    recipes: merged,
    loading: !(ownedReady && sharedReady && autoReady),
  };
}

function snapToMap(
  snap: QuerySnapshot<DocumentData>,
  access: RecipeListItem["access"],
): Map<string, RecipeListItem> {
  const out = new Map<string, RecipeListItem>();
  for (const d of snap.docs) out.set(d.id, summarize(d.data(), d.id, access));
  return out;
}
