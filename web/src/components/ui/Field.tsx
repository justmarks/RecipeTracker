import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  /** Helper text shown below the input when there's no error. */
  hint?: string;
  /** Error text — overrides hint when present. Rendered in tomato. */
  error?: string;
  children: ReactNode;
}

/**
 * Form-field wrapper: bold 13px label above the input, optional
 * hint or error line below. Wraps its children in a <label> so
 * native label-for-input association works without `htmlFor`.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[13px] font-semibold text-ink-900">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-tomato-700">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}
