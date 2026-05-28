import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { favoriteDocId } from "shared";

/**
 * Subscribe to the signed-in user's favorites and expose a toggle
 * action. Favorites live in their own top-level collection
 * (`favorites/{uid}_{recipeId}`) so we don't have to mutate the recipe
 * doc — important because users can favorite recipes they don't own
 * (shared / auto-shared), and writing the recipe would be blocked by
 * security rules.
 *
 * Returns a Set for O(1) membership checks, plus a `toggle` that
 * applies an optimistic local update before the Firestore round-trip
 * so the heart icon flips instantly on click.
 */
export function useFavorites(uid: string | undefined): {
  favorites: Set<string>;
  loading: boolean;
  toggle: (recipeId: string) => Promise<void>;
  isFavorite: (recipeId: string) => boolean;
} {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // Mirror the latest set in a ref so `toggle` can read it without
  // re-binding on every snapshot — keeps the returned function stable.
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  useEffect(() => {
    if (!uid) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "favorites"), where("uid", "==", uid)),
      (snap) => {
        const next = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data() as { recipeId?: string };
          if (data.recipeId) next.add(data.recipeId);
        });
        setFavorites(next);
        setLoading(false);
      },
      (err) => {
        console.error("Favorites snapshot:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  const toggle = useCallback(
    async (recipeId: string) => {
      if (!uid) return;
      const ref = doc(db, "favorites", favoriteDocId(uid, recipeId));
      const wasFavorite = favoritesRef.current.has(recipeId);

      // Optimistic local update — the listener will reconcile on the
      // next snapshot, but the icon flips immediately.
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(recipeId);
        else next.add(recipeId);
        return next;
      });

      try {
        if (wasFavorite) {
          await deleteDoc(ref);
        } else {
          await setDoc(ref, {
            uid,
            recipeId,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("Toggle favorite:", err);
        // Revert the optimistic update so the icon stays truthful.
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(recipeId);
          else next.delete(recipeId);
          return next;
        });
        throw err;
      }
    },
    [uid],
  );

  const isFavorite = useCallback(
    (recipeId: string) => favoritesRef.current.has(recipeId),
    [],
  );

  return { favorites, loading, toggle, isFavorite };
}
