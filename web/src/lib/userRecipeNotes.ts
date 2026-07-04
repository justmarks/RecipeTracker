import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export function personalNoteDocId(uid: string, recipeId: string): string {
  return `${uid}_${recipeId}`;
}

/**
 * Reads and writes the current user's personal note for a recipe.
 * Returns `notes: null` while loading, then `""` (no note) or a string.
 * Call `save(text)` on blur — it upserts the doc with serverTimestamp.
 */
export function usePersonalNote(
  recipeId: string | undefined,
  uid: string | undefined,
) {
  const [notes, setNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recipeId || !uid) return;
    return onSnapshot(
      doc(db, "userRecipeNotes", personalNoteDocId(uid, recipeId)),
      (snap) => setNotes(snap.exists() ? (snap.data().notes as string) : ""),
    );
  }, [recipeId, uid]);

  async function save(text: string): Promise<void> {
    if (!recipeId || !uid) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "userRecipeNotes", personalNoteDocId(uid, recipeId)),
        { uid, recipeId, notes: text, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } finally {
      setSaving(false);
    }
  }

  return { notes, saving, save };
}
