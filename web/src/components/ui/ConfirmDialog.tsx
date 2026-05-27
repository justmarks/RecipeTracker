import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  /** Controlled open state. When toggled true, calls showModal(). */
  open: boolean;
  title: string;
  message: string;
  /** Confirm button label. Default: "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
  /** Called on Confirm click. The parent is responsible for closing (set open=false). */
  onConfirm: () => void;
  /** Called on Cancel click, Esc, or backdrop click. */
  onCancel: () => void;
}

/**
 * Modal confirmation dialog built on native `<dialog>`. Native gives us
 * focus trap, Esc dismiss, and inert-outside-the-dialog for free.
 * Backdrop click also dismisses (we add that manually — native doesn't).
 *
 * Keep the message single-sentence and the action label specific
 * ("Delete recipe", "Discard changes") so the consequence is obvious
 * before the user clicks.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  // Backdrop click — the dialog element itself receives the event when
  // the click lands on the ::backdrop pseudo-element. Content clicks
  // bubble from a child, so their target won't equal the dialog node.
  function onDialogClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onCancel();
  }

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={onDialogClick}
      className={[
        "p-0 bg-transparent border-0",
        "backdrop:bg-ink-900/50",
        // Override native dialog's default centering with our own card.
      ].join(" ")}
    >
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-[420px] w-[90vw]">
        <h2 className="font-display text-[22px] font-medium text-ink-900 m-0 mb-2 leading-snug">
          {title}
        </h2>
        <p className="font-sans text-sm leading-relaxed text-ink-700 m-0 mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
