interface StarRatingProps {
  /** 0–5. Values outside the range are clamped. Non-integers round to nearest. */
  value: number;
  /** Pixel size of each star. Defaults to 18 — the recipe-detail size. */
  size?: number;
  /**
   * When true (default), unfilled positions render as outline stars in
   * ink-300. When false, only filled stars render — useful for compact
   * spots like list-row meta where empty stars would crowd the line.
   */
  showEmpty?: boolean;
  /** Override the default aria-label ("Rated N out of 5"). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Saffron-filled star rating per the design system — `saffron-500` fill
 * for filled stars, `ink-300` stroke outline for empty ones. Replaces the
 * earlier Unicode ★ approach so the strokes stay crisp at every size and
 * the empty state doesn't lean on a font's glyph variant.
 *
 * The path is the same compound geometry used in the kit's StarRating
 * primitive — five-point star with rounded line joins. Stars are rendered
 * inline with a small gap so they read as a rating, not as a single icon.
 */
export function StarRating({
  value,
  size = 18,
  showEmpty = true,
  ariaLabel,
  className = "",
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  const stars = [1, 2, 3, 4, 5];
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={ariaLabel ?? `Rated ${clamped} out of 5`}
    >
      {stars.map((n) => {
        const filled = n <= clamped;
        if (!filled && !showEmpty) return null;
        return (
          <svg
            key={n}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? "var(--saffron-500)" : "none"}
            stroke={filled ? "var(--saffron-500)" : "var(--ink-300)"}
            strokeWidth={1.5}
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3 L14.5 8.7 L20.5 9.3 L16 13.4 L17.4 19.3 L12 16.1 L6.6 19.3 L8 13.4 L3.5 9.3 L9.5 8.7 Z" />
          </svg>
        );
      })}
    </span>
  );
}
