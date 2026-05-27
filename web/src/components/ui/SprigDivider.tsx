interface SprigDividerProps {
  className?: string;
}

/**
 * Decorative olive-sprig divider — two thin lines flanking a small
 * herbal flourish with a tomato berry in the middle. Use sparingly:
 * between Ingredients and Instructions in the print-style recipe
 * detail, or as a chapter break on long-form views.
 *
 * SVG is inlined (not loaded from /assets) so colors track the
 * design system via CSS variables — if the palette ever shifts,
 * the divider follows.
 */
export function SprigDivider({ className = "" }: SprigDividerProps) {
  return (
    <div className={`flex justify-center my-6 ${className}`} aria-hidden="true">
      <svg
        width="240"
        height="32"
        viewBox="0 0 240 40"
        fill="none"
        role="presentation"
      >
        <line
          x1="10"
          y1="20"
          x2="92"
          y2="20"
          stroke="var(--paper-400)"
          strokeWidth="1"
        />
        <line
          x1="148"
          y1="20"
          x2="230"
          y2="20"
          stroke="var(--paper-400)"
          strokeWidth="1"
        />
        <g transform="translate(120 20)">
          <path
            d="M -22 0 Q 0 -10 22 0"
            stroke="var(--olive-700)"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse
            cx="-14"
            cy="-4"
            rx="5"
            ry="2.2"
            fill="var(--olive-500)"
            transform="rotate(-20 -14 -4)"
          />
          <ellipse
            cx="-4"
            cy="-7"
            rx="5"
            ry="2.2"
            fill="var(--olive-500)"
            transform="rotate(-10 -4 -7)"
          />
          <ellipse
            cx="6"
            cy="-7"
            rx="5"
            ry="2.2"
            fill="var(--olive-500)"
            transform="rotate(10 6 -7)"
          />
          <ellipse
            cx="14"
            cy="-4"
            rx="5"
            ry="2.2"
            fill="var(--olive-500)"
            transform="rotate(20 14 -4)"
          />
          <circle cx="0" cy="0" r="2.4" fill="var(--tomato-500)" />
        </g>
      </svg>
    </div>
  );
}
