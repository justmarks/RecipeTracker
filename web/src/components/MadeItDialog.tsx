import { useEffect, useRef, useState } from "react";
import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Button, Field, Input, Select } from "./ui";

interface MadeItDialogProps {
  open: boolean;
  recipeId: string;
  existingRating?: number;
  existingDate?: string;
  onClose: () => void;
  /** Called with the values that were saved, for optimistic UI update. */
  onSaved: (date: string, rating: number | undefined) => void;
}

export function MadeItDialog({
  open,
  recipeId,
  existingRating,
  existingDate,
  onClose,
  onSaved,
}: MadeItDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(todayLocalISO);
  const [rating, setRating] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields to current recipe values each time the dialog opens.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setDate(existingDate ?? todayLocalISO());
      setRating(existingRating != null ? String(existingRating) : "");
      setError(null);
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open, existingDate, existingRating]);

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    setError(null);
    try {
      type UpdatePayload = {
        lastMadeDate: string;
        updatedAt: ReturnType<typeof serverTimestamp>;
        rating?: number | ReturnType<typeof deleteField>;
      };
      const payload: UpdatePayload = {
        lastMadeDate: date,
        updatedAt: serverTimestamp(),
      };
      if (rating !== "") {
        payload.rating = Number(rating);
      } else if (existingRating != null) {
        // User explicitly cleared the rating — remove the field.
        payload.rating = deleteField();
      }
      await updateDoc(doc(db, "recipes", recipeId), payload);
      onSaved(date, rating !== "" ? Number(rating) : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-[400px] rounded-xl bg-white p-0 shadow-lg backdrop:bg-ink-900/50 open:flex open:flex-col"
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div className="px-6 pt-6 pb-5">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-5">
          Mark as made
        </h2>
        <div className="flex flex-col gap-4">
          <Field label="Date">
            <Input
              type="date"
              value={date}
              max={todayLocalISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Rating">
            <Select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">— No rating —</option>
              <option value="1">★</option>
              <option value="2">★ ★</option>
              <option value="3">★ ★ ★</option>
              <option value="4">★ ★ ★ ★</option>
              <option value="5">★ ★ ★ ★ ★</option>
            </Select>
          </Field>
          {error && (
            <p className="font-sans text-sm text-tomato-700">{error}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-paper-200">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          icon="list-checks"
          onClick={handleSave}
          disabled={saving || !date}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </dialog>
  );
}

function todayLocalISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
