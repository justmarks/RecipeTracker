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
        // `m-auto` restores the dialog's browser-default centering
        // that Tailwind's preflight zeros out (`* { margin: 0 }`).
        // Without it, native <dialog> elements snap to the
        // top-left/right corner of the viewport instead of centering.
        "m-auto p-0 bg-transparent border-0",
        "backdrop:bg-ink-900/50",
      ].join(" ")}
    >
      {/*
        `<form method="dialog">` is the native handshake for "Enter
        fires the default action". The browser treats the first
        submit-type button in the form as the dialog's default button,
        so the user pressing Enter anywhere in the dialog runs onConfirm.
        We still preventDefault to keep React in charge of close timing
        — the parent controls `open` and will close on the next render.
      */}
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
        className="bg-white rounded-xl shadow-lg p-6 max-w-[420px] w-[90vw]"
      >
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-2 leading-snug">
          {title}
        </h2>
        <p className="font-sans text-sm leading-relaxed text-ink-700 m-0 mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {/*
            autoFocus on the primary action so the dialog opens with
            focus on Confirm. Native <dialog> otherwise auto-focuses
            the first focusable element (the Cancel button), and when
            a button has focus, Enter fires a click on THAT button —
            bypassing the form's default-submit mechanism. The user's
            "Delete tag" + Enter would land on "Keep" without this.
          */}
          <Button type="submit" variant="primary" autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
