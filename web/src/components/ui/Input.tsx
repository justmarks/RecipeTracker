import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Standard text input. White card on cream paper, paper-400 border,
 * warm focus ring (tomato halo). 14px Manrope body, 8px radius.
 *
 * Use inside <Field label="…"> for the labelled / hinted form pattern.
 */
export function Input({ className = "", type = "text", ...rest }: InputProps) {
  const classes = [
    "w-full font-sans text-sm text-ink-900 bg-white",
    "border border-paper-400 rounded-md px-3 py-2.5",
    "outline-none transition-colors duration-100 ease-out",
    "focus:border-tomato-500 focus:shadow-[var(--shadow-focus)]",
    "placeholder:text-ink-300",
    "disabled:bg-paper-200 disabled:text-ink-500 disabled:cursor-not-allowed",
    className,
  ].join(" ");

  return <input type={type} className={classes} {...rest} />;
}
