import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_CHAPTERS, UNCATEGORIZED_CHAPTER } from "shared";

const FIRESTORE_BATCH_LIMIT = 500;

function userDocRef(uid: string) {
  return doc(db, "users", uid);
}

/**
 * Subscribe to the signed-in user's chapter list. Seeds the default
 * chapters the first time it observes a missing document.
 */
export function useChapters(uid: string | undefined): {
  chapters: string[];
  loading: boolean;
} {
  const [chapters, setChapters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setChapters([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      userDocRef(uid),
      async (snap) => {
        if (!snap.exists()) {
          // First sign-in for this user. Seed defaults and the listener
          // will fire again with the new data on the next tick.
          try {
            await setDoc(userDocRef(uid), {
              ownerId: uid,
              categories: [...DEFAULT_CHAPTERS],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            console.error("Seed chapters:", err);
            // Fall through with defaults so the UI still works locally.
            setChapters([...DEFAULT_CHAPTERS]);
            setLoading(false);
          }
          return;
        }
        const data = snap.data();
        setChapters(Array.isArray(data.categories) ? data.categories : []);
        setLoading(false);
      },
      (err) => {
        console.error("Chapters snapshot:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  return { chapters, loading };
}

function normalize(name: string): string {
  // Trim and collapse internal whitespace. Case is PRESERVED so users can
  // store "BBQ" or "Pasta Night" exactly as typed. Uniqueness is enforced
  // case-insensitively via nameKey() below.
  return name.trim().replace(/\s+/g, " ");
}

function nameKey(name: string): string {
  // Comparison key — chapter names are unique case-insensitively, so
  // "BBQ" and "bbq" collide and only one can exist at a time.
  return normalize(name).toLowerCase();
}

export async function addChapter(uid: string, name: string): Promise<string> {
  const normalized = normalize(name);
  if (!normalized) throw new Error("Chapter name cannot be empty.");
  if (normalized.length > 100) throw new Error("Chapter name is too long.");

  const snap = await getDoc(userDocRef(uid));
  const current: string[] = snap.exists()
    ? (snap.data().categories ?? [])
    : [];
  const key = nameKey(normalized);
  if (current.some((c) => nameKey(c) === key)) {
    throw new Error(`Chapter "${normalized}" already exists.`);
  }
  await setDoc(
    userDocRef(uid),
    {
      ownerId: uid,
      categories: [...current, normalized],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return normalized;
}

/**
 * Rename a chapter. Atomically updates the user's chapter list and
 * every recipe currently using the old name. Refuses to merge into an
 * existing chapter — caller must delete or reassign first.
 */
export async function renameChapter(
  uid: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const newNormalized = normalize(newName);
  if (!newNormalized) throw new Error("Chapter name cannot be empty.");
  if (newNormalized.length > 100) throw new Error("Chapter name is too long.");
  if (newNormalized === oldName) return;

  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) throw new Error("No chapter list yet.");
  const current: string[] = snap.data().categories ?? [];
  if (!current.includes(oldName)) throw new Error("Chapter not found.");
  // Allow a pure case-change rename ("entree" → "Entree") even though it
  // collides under nameKey — only block when collapsing into a *different*
  // existing entry.
  const newKey = nameKey(newNormalized);
  if (current.some((c) => c !== oldName && nameKey(c) === newKey)) {
    throw new Error(`Chapter "${newNormalized}" already exists.`);
  }

  const updated = current.map((c) => (c === oldName ? newNormalized : c));

  const recipesSnap = await getDocs(
    query(
      collection(db, "recipes"),
      where("ownerId", "==", uid),
      where("category", "==", oldName),
    ),
  );

  // Firestore batches cap at 500 operations including the user doc update.
  if (recipesSnap.size + 1 > FIRESTORE_BATCH_LIMIT) {
    throw new Error(
      `Too many recipes (${recipesSnap.size}) to rename in one batch. ` +
        "Move some recipes to another chapter first.",
    );
  }

  const batch = writeBatch(db);
  batch.set(
    userDocRef(uid),
    { categories: updated, updatedAt: serverTimestamp() },
    { merge: true },
  );
  recipesSnap.forEach((d) => {
    batch.update(d.ref, {
      category: newNormalized,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Delete a chapter. Any recipes still in this chapter are atomically
 * reassigned to the "uncategorized" fallback chapter (auto-added to the
 * user's chapter list if it isn't already there). The "uncategorized"
 * chapter itself cannot be deleted — it's the safety net.
 */
export async function deleteChapter(uid: string, name: string): Promise<void> {
  if (nameKey(name) === nameKey(UNCATEGORIZED_CHAPTER)) {
    throw new Error(
      `Can't delete the "${UNCATEGORIZED_CHAPTER}" chapter — ` +
        "it's the fallback for unassigned recipes.",
    );
  }

  const userSnap = await getDoc(userDocRef(uid));
  if (!userSnap.exists()) return;
  const current: string[] = userSnap.data().categories ?? [];
  if (!current.includes(name)) return;

  const recipesSnap = await getDocs(
    query(
      collection(db, "recipes"),
      where("ownerId", "==", uid),
      where("category", "==", name),
    ),
  );

  // Preserve the user's preferred casing if they already have an
  // "Uncategorized"/"UNCATEGORIZED" chapter under a different case. Otherwise
  // fall back to the canonical lowercase form.
  const existingFallback = current.find(
    (c) => nameKey(c) === nameKey(UNCATEGORIZED_CHAPTER),
  );
  const targetCategory = existingFallback ?? UNCATEGORIZED_CHAPTER;

  // Build the new chapter list: drop the deleted one, and append
  // "uncategorized" if it isn't present AND we actually have recipes to
  // rehome (no point cluttering the list if the chapter was already empty).
  let updated = current.filter((c) => c !== name);
  if (!existingFallback && !recipesSnap.empty) {
    updated = [...updated, UNCATEGORIZED_CHAPTER];
  }

  // Batch caps at 500 ops including the user doc update.
  if (recipesSnap.size + 1 > FIRESTORE_BATCH_LIMIT) {
    throw new Error(
      `Too many recipes (${recipesSnap.size}) to move in one batch. ` +
        "Move some recipes to another chapter first.",
    );
  }

  const batch = writeBatch(db);
  batch.set(
    userDocRef(uid),
    { categories: updated, updatedAt: serverTimestamp() },
    { merge: true },
  );
  recipesSnap.forEach((d) => {
    batch.update(d.ref, {
      category: targetCategory,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function moveChapter(
  uid: string,
  name: string,
  direction: "up" | "down",
): Promise<void> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return;
  const current: string[] = snap.data().categories ?? [];
  const idx = current.indexOf(name);
  if (idx === -1) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= current.length) return;
  const updated = [...current];
  [updated[idx], updated[swapWith]] = [updated[swapWith], updated[idx]];
  await setDoc(
    userDocRef(uid),
    { categories: updated, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
