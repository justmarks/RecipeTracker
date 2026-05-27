import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

/**
 * ALL-CAPS small-caps label sitting above a heading. 11px Manrope 600,
 * 0.12em tracking. The only place uppercase is acceptable per the
 * content guidelines — used for "INGREDIENTS", "PREP", "COOK", and
 * the eyebrows above page subheads.
 */
export function Eyebrow({ children, className = "" }: EyebrowProps) {
  return (
    <div
      className={[
        "font-sans font-semibold text-[11px] uppercase",
        "tracking-[0.12em] text-ink-500",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
