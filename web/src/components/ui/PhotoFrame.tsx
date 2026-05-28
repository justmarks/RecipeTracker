import type { CSSProperties } from "react";

interface PhotoFrameProps {
  src?: string;
  alt?: string;
  /** Aspect ratio as a CSS aspect-ratio string. Defaults to "4 / 3". */
  ratio?: string;
  /**
   * Border radius — design-system tokens map roughly as:
   *   "sm"  → 10px (list-row thumbs)
   *   "lg"  → 14px (cards, recipe-detail hero on desktop)
   *   "none" → 0 (full-bleed hero on mobile)
   */
  radius?: "sm" | "lg" | "none";
  /** Hairline border around the frame. Defaults to true; pass false for full-bleed. */
  border?: boolean;
  /** Extra Tailwind classes (e.g. fixed width for thumbs). */
  className?: string;
  /** Inline style for cases where Tailwind can't express the layout (rare). */
  style?: CSSProperties;
}

const RADIUS_CLASS: Record<NonNullable<PhotoFrameProps["radius"]>, string> = {
  sm: "rounded-[10px]",
  lg: "rounded-lg",
  none: "rounded-none",
};

/**
 * Unified photo treatment per the design system. Always paper-200 backed,
 * `object-cover`, optional hairline border, with an honest empty state
 * (italic Newsreader "No photo yet" + camera glyph) so a missing image
 * looks intentional rather than broken.
 *
 * Use this for: list-row thumbnails (64px square, radius="sm"), recipe
 * cards (4:3, radius="lg"), and recipe-detail hero (3:2 or full-bleed).
 * Never apply filters or overlays on top — the cookbook page already
 * provides the warmth.
 */
export function PhotoFrame({
  src,
  alt = "",
  ratio = "4 / 3",
  radius = "lg",
  border = true,
  className = "",
  style,
}: PhotoFrameProps) {
  const classes = [
    "relative overflow-hidden bg-paper-200 flex items-center justify-center",
    RADIUS_CLASS[radius],
    border ? "border border-paper-300" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ aspectRatio: ratio, ...style }}
      aria-hidden={src ? undefined : true}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover block"
        />
      ) : (
        <EmptyPhotoStamp />
      )}
    </div>
  );
}

function EmptyPhotoStamp() {
  return (
    <div className="flex flex-col items-center gap-1.5 text-ink-300 font-display italic text-[13px]">
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <rect x="4" y="6" width="24" height="20" rx="2" />
        <circle cx="12" cy="13" r="2" />
        <path d="M4 22 L11 16 L17 21 L22 17 L28 22" />
      </svg>
    </div>
  );
}
