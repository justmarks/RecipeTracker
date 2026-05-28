import type { SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Standard select. Matches Input's border / radius / typography so
 * paired fields line up, with the native browser arrow hidden in
 * favor of a lucide chevron-down — the default arrow varies across
 * browsers and clashes with the editorial vibe of the design system.
 *
 * Use inside <Field label="…"> for the labelled / hinted form pattern.
 */
export function Select({ className = "", children, ...rest }: SelectProps) {
  const classes = [
    "w-full font-sans text-sm text-ink-900 bg-white",
    "border border-paper-400 rounded-md pl-3 pr-9 py-2.5",
    "outline-none transition-colors duration-100 ease-out cursor-pointer",
    "appearance-none",
    "focus:border-tomato-500 focus:shadow-[var(--shadow-focus)]",
    "disabled:bg-paper-200 disabled:text-ink-500 disabled:cursor-not-allowed",
    className,
  ].join(" ");

  return (
    <div className="relative">
      <select className={classes} {...rest}>
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
      >
        <Icon name="chevron-down" size={16} />
      </span>
    </div>
  );
}
