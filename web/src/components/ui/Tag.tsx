import type { ReactNode } from "react";

export type TagTone = "default" | "tomato" | "olive" | "saffron" | "plum";

export const TAG_TONES: TagTone[] = [
  "default",
  "tomato",
  "olive",
  "saffron",
  "plum",
];

const TAG_CLASSES: Record<TagTone, string> = {
  default: "bg-paper-200 text-ink-700",
  tomato: "bg-tomato-50 text-tomato-700",
  olive: "bg-olive-100 text-olive-700",
  saffron: "bg-saffron-100 text-saffron-700",
  plum: "bg-plum-100 text-plum-700",
};

/**
 * Swatch background classes — used by the tag-management color picker
 * to render a small solid-ish disc per tone. Keeps the swatch palette
 * in lockstep with the chip palette above.
 */
export const TAG_SWATCH_CLASSES: Record<TagTone, string> = {
  default: "bg-paper-300",
  tomato: "bg-tomato-300",
  olive: "bg-olive-300",
  saffron: "bg-saffron-300",
  plum: "bg-plum-300",
};

interface TagProps {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}

/**
 * Small flat chip used for tags (vegetarian, gluten-free) and category
 * marks. Pluck the tone with tagToneFor(name, palette?) to keep the
 * dish-type → color mapping centralized.
 *
 * Pills are reserved for avatars and the chapter section counter —
 * use rounded-sm here, not rounded-pill.
 */
export function Tag({ tone = "default", children, className = "" }: TagProps) {
  const classes = [
    "inline-block font-sans text-xs font-medium",
    "px-2 py-0.5 rounded-sm whitespace-nowrap",
    TAG_CLASSES[tone],
    className,
  ].join(" ");
  return <span className={classes}>{children}</span>;
}

/**
 * Map a tag string to its display tone. The user's palette (stored on
 * users/{uid}.tagColors) wins; otherwise a small built-in heuristic
 * gives common tags a sensible default so a brand-new user sees color
 * variety without configuring anything. Everything else falls through
 * to "default".
 */
export function tagToneFor(
  tag: string,
  palette?: Record<string, TagTone>,
): TagTone {
  const t = tag.toLowerCase();
  const override = palette?.[t];
  if (override) return override;
  return "default";
}
