interface BrandProps {
  /**
   * - "lockup" (default): monogram + two-line wordmark side-by-side. For sidebar.
   * - "stacked": monogram on top, wordmark below. For sign-in cards / launch.
   * - "mark": just the M monogram circle. For top bars and avatars.
   */
  variant?: "lockup" | "stacked" | "mark";
  /** Pixel size of the monogram circle. Defaults to 34 (lockup) / 72 (stacked) / 32 (mark). */
  size?: number;
  className?: string;
}

/**
 * Marks Family Recipe Book brand mark.
 *
 * The "Marks Family" line is Newsreader semibold; "Recipe Book" is
 * Newsreader italic in tomato. The monogram is an inline SVG so it
 * uses the design tokens for color — if the tomato shifts, the
 * monogram follows automatically.
 */
export function Brand({ variant = "lockup", size, className = "" }: BrandProps) {
  if (variant === "mark") {
    return <Monogram size={size ?? 32} className={className} />;
  }

  if (variant === "stacked") {
    const monogramSize = size ?? 72;
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <Monogram size={monogramSize} className="mb-5" />
        <h1 className="font-display text-2xl font-semibold leading-[1.05] tracking-tight text-ink-900 m-0">
          Marks Family
        </h1>
        <p className="font-display italic text-xl leading-[1.05] text-tomato-500 mt-0.5 mb-0">
          Recipe Book
        </p>
      </div>
    );
  }

  // Default: horizontal lockup for the sidebar / top bar.
  const monogramSize = size ?? 34;
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Monogram size={monogramSize} />
      <div className="flex flex-col leading-[1.25] min-w-0">
        <span className="font-display text-base font-semibold text-ink-900">
          Marks Family
        </span>
        <span className="font-display italic text-sm text-tomato-500">
          Recipe Book
        </span>
      </div>
    </div>
  );
}

interface MonogramProps {
  size?: number;
  className?: string;
}

/**
 * The M monogram on a tomato circle. Used in the sign-in screen, the
 * sidebar lockup, and the favicon source.
 */
function Monogram({ size = 34, className = "" }: MonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="58" fill="var(--tomato-500)" />
      <text
        x="60"
        y="86"
        fontFamily="'Newsreader', 'Georgia', serif"
        fontWeight="600"
        fontSize="78"
        fill="var(--paper-100)"
        textAnchor="middle"
        letterSpacing="-3"
      >
        M
      </text>
    </svg>
  );
}
