import type { ReactElement, SVGProps } from "react";

/**
 * Lucide-style stroke icons, inlined as React fragments to keep the
 * primitives bundle self-contained (no Lucide runtime). 1.5px stroke,
 * 24x24 viewBox, `currentColor`. Sizes default to 20px.
 *
 * Add new icons to ICON_PATHS rather than reaching for a third-party
 * library — keeps the icon set small and consistent with the design
 * system's editorial / book vibe (outline only, never filled).
 */

export type IconName =
  | "plus"
  | "search"
  | "book-open"
  | "chevron-right"
  | "chevron-left"
  | "chevron-up"
  | "chevron-down"
  | "arrow-left"
  | "pencil"
  | "share"
  | "link"
  | "upload"
  | "x"
  | "check"
  | "clock"
  | "trash"
  | "log-out"
  | "users"
  | "sparkles"
  | "settings"
  | "user"
  | "bookmark"
  | "file-text"
  | "share-2"
  | "mail"
  | "download"
  | "heart"
  | "grip-vertical"
  | "git-merge"
  | "utensils"
  | "printer"
  | "image";

const ICON_PATHS: Record<IconName, ReactElement> = {
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </>
  ),
  "book-open": (
    <>
      <path d="M2 4 L10 6 L10 20 L2 18 Z" />
      <path d="M22 4 L14 6 L14 20 L22 18 Z" />
      <path d="M10 6 L14 6" />
    </>
  ),
  "chevron-right": <polyline points="9 6 15 12 9 18" />,
  "chevron-left": <polyline points="15 6 9 12 15 18" />,
  "chevron-down": <polyline points="6 9 12 15 18 9" />,
  "chevron-up": <polyline points="6 15 12 9 18 15" />,
  "arrow-left": (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
  pencil: (
    <>
      <path d="M16 3 L21 8 L8 21 L3 21 L3 16 Z" />
      <line x1="14" y1="5" x2="19" y2="10" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <line x1="8.5" y1="11" x2="15.5" y2="7.5" />
      <line x1="8.5" y1="13" x2="15.5" y2="16.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14 a4 4 0 0 1 0-6 l3-3 a4 4 0 0 1 6 6 l-1 1" />
      <path d="M14 10 a4 4 0 0 1 0 6 l-3 3 a4 4 0 0 1-6-6 l1-1" />
    </>
  ),
  upload: (
    <>
      <line x1="12" y1="3" x2="12" y2="15" />
      <polyline points="7 8 12 3 17 8" />
      <path d="M3 17 v3 a1 1 0 0 0 1 1 h16 a1 1 0 0 0 1-1 v-3" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  check: <polyline points="4 12 10 18 20 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </>
  ),
  trash: (
    <>
      <polyline points="3 6 21 6" />
      <path d="M5 6 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 v-14" />
      <path d="M9 6 V4 a1 1 0 0 1 1-1 h4 a1 1 0 0 1 1 1 v2" />
    </>
  ),
  "log-out": (
    <>
      <path d="M14 4 h4 a2 2 0 0 1 2 2 v12 a2 2 0 0 1-2 2 h-4" />
      <polyline points="9 16 4 12 9 8" />
      <line x1="4" y1="12" x2="16" y2="12" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21 v-1 a5 5 0 0 1 5-5 h4 a5 5 0 0 1 5 5 v1" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14 h2 a4 4 0 0 1 4 4 v1" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z" />
      <path d="M19 3 L19.5 5 L21.5 5.5 L19.5 6 L19 8 L18.5 6 L16.5 5.5 L18.5 5 Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 v-1 a6 6 0 0 1 6-6 h4 a6 6 0 0 1 6 6 v1" />
    </>
  ),
  bookmark: <path d="M19 21 l-7-5 -7 5 V5 a2 2 0 0 1 2-2 h10 a2 2 0 0 1 2 2 z" />,
  "file-text": (
    <>
      <path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>
  ),
  "share-2": (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </>
  ),
  download: (
    <>
      <path d="M3 17 v3 a1 1 0 0 0 1 1 h16 a1 1 0 0 0 1-1 v-3" />
      <polyline points="7 12 12 17 17 12" />
      <line x1="12" y1="3" x2="12" y2="17" />
    </>
  ),
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  "grip-vertical": (
    <>
      <circle cx="9" cy="7" r="1.25" stroke="none" fill="currentColor" />
      <circle cx="15" cy="7" r="1.25" stroke="none" fill="currentColor" />
      <circle cx="9" cy="12" r="1.25" stroke="none" fill="currentColor" />
      <circle cx="15" cy="12" r="1.25" stroke="none" fill="currentColor" />
      <circle cx="9" cy="17" r="1.25" stroke="none" fill="currentColor" />
      <circle cx="15" cy="17" r="1.25" stroke="none" fill="currentColor" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M3 17 L9 12 L13 15 L17 11 L21 15" />
    </>
  ),
  // Lucide git-merge — two nodes (bottom-left + top-right) joined by
  // a curve. Reads as "fold A into B" which is exactly the tag-merge
  // mental model.
  "git-merge": (
    <>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21 V9 a9 9 0 0 0 9 9" />
    </>
  ),
  // Fork + knife — the meal-plan affordance. Left shape is a fork
  // (tines down at top, handle to bottom); right shape is a knife
  // (broad blade at top, handle to bottom). Same outline-only feel
  // as the rest of the icon set.
  utensils: (
    <>
      <path d="M3 2 v7 a2 2 0 0 0 2 2 h1 v11" />
      <path d="M7 2 v9" />
      <path d="M11 2 v9" />
      <path d="M21 15 V2 a5 5 0 0 0-5 5 v6 a2 2 0 0 0 2 2 h3 v7" />
    </>
  ),
  // Printer — used by the meal-plan print button. Compact paper +
  // body + paper-out stack reads as a desk printer at any size.
  printer: (
    <>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18 H4 a2 2 0 0 1-2-2 v-5 a2 2 0 0 1 2-2 h16 a2 2 0 0 1 2 2 v5 a2 2 0 0 1-2 2 h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /**
   * Fill the icon with currentColor instead of outline-only. Used for
   * stateful icons like a favorited heart. Stroke stays so the shape
   * stays crisp on light backgrounds.
   */
  filled?: boolean;
}

export function Icon({
  name,
  size = 20,
  className,
  filled = false,
  ...rest
}: IconProps) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  );
}
