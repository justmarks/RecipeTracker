import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Button, Icon, Input } from "./ui";
import { callShareRecipe, callUnshareRecipe } from "../lib/sharing";
import { trackEvent } from "../lib/analytics";

interface ShareDialogProps {
  open: boolean;
  recipeId: string;
  recipeTitle: string;
  /**
   * Current explicit-share list pulled off the recipe doc. Pass the
   * latest snapshot in so changes outside the dialog (e.g. an unshare
   * from another tab) reflect when re-opened.
   */
  sharedWithDetails: { uid: string; email: string }[];
  onClose: () => void;
  /** Fired after a successful add or remove with the new list. */
  onChange: (next: { uid: string; email: string }[]) => void;
}

/**
 * Per-recipe share modal. Owner enters a family member's email; we
 * resolve it to a uid server-side, append it to the recipe's
 * `sharedWith` array, and denormalize {uid, email} into
 * `sharedWithDetails` so the UI can show who has access without an
 * extra Auth round-trip on each render.
 *
 * Built on the same native `<dialog>` pattern as ConfirmDialog —
 * focus trap, Esc, inert-outside, and backdrop click all come for free.
 */
export function ShareDialog({
  open,
  recipeId,
  recipeTitle,
  sharedWithDetails,
  onClose,
  onChange,
}: ShareDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setEmail("");
      setError(null);
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  function onDialogClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onClose();
  }

  async function handleAdd() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await callShareRecipe({
        recipeId,
        granteeEmail: trimmed,
      });
      const grantee = result.data.grantee;
      // Skip duplicate if the function reported an already-shared user.
      const exists = sharedWithDetails.some((d) => d.uid === grantee.uid);
      if (!exists) trackEvent("recipe_shared");
      onChange(exists ? sharedWithDetails : [...sharedWithDetails, grantee]);
      setEmail("");
    } catch (err) {
      console.error("shareRecipe:", err);
      setError(err instanceof Error ? err.message : "Could not share.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(granteeUid: string) {
    setBusy(true);
    setError(null);
    try {
      await callUnshareRecipe({ recipeId, granteeUid });
      onChange(sharedWithDetails.filter((d) => d.uid !== granteeUid));
    } catch (err) {
      console.error("unshareRecipe:", err);
      setError(err instanceof Error ? err.message : "Could not unshare.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onDialogClick}
      className="m-auto p-0 bg-transparent border-0 backdrop:bg-ink-900/50"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-[480px] w-[92vw]">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-1 leading-snug">
          Share recipe
        </h2>
        <p className="font-sans text-sm text-ink-700 m-0 mb-5">
          <span className="font-display italic">{recipeTitle}</span> — anyone
          you add can see this recipe but not edit or delete it.
        </p>

        <div className="flex gap-2 mb-1">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="family@example.com"
            className="flex-1"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email.trim() && !busy) {
                e.preventDefault();
                handleAdd();
              }
            }}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            icon="share-2"
            onClick={handleAdd}
            disabled={busy || !email.trim()}
          >
            {busy ? "Sharing…" : "Share"}
          </Button>
        </div>
        {error && (
          <p className="font-sans text-sm text-tomato-700 m-0 mt-1.5">
            {error}
          </p>
        )}

        {sharedWithDetails.length > 0 ? (
          <div className="mt-6">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2">
              Shared with
            </p>
            <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
              {sharedWithDetails.map((d) => (
                <li
                  key={d.uid}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-paper-100"
                >
                  <span className="text-ink-500 shrink-0">
                    <Icon name="mail" size={14} />
                  </span>
                  <span className="flex-1 min-w-0 font-sans text-sm text-ink-700 truncate">
                    {d.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(d.uid)}
                    disabled={busy}
                    className="font-sans text-xs text-tomato-700 hover:text-tomato-600 px-2 py-0.5 disabled:opacity-50 cursor-pointer"
                    aria-label={`Stop sharing with ${d.email}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="font-sans text-sm text-ink-500 mt-5 m-0">
            No one else has access yet. To share all your recipes with a
            family member, use{" "}
            <span className="text-ink-700">Settings → Sharing</span>.
          </p>
        )}

        <div className="flex justify-end mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
