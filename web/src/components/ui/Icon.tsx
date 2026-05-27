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
  | "file-text";

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
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
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
