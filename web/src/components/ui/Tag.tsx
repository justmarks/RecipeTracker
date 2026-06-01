import type { ReactNode } from "react";

export type TagTone = "default" | "brand" | "veg" | "gf" | "dessert";

const TAG_CLASSES: Record<TagTone, string> = {
  default: "bg-paper-200 text-ink-700",
  brand: "bg-tomato-50 text-tomato-700",
  veg: "bg-olive-100 text-olive-700",
  gf: "bg-saffron-100 text-saffron-700",
  dessert: "bg-plum-100 text-plum-700",
};

interface TagProps {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}

/**
 * Small flat chip used for tags (vegetarian, gluten-free) and category
 * marks. Pluck the tone with tagToneFor(name) to keep the dish-type
 * → color mapping centralized.
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
 * Map a tag string to its display tone. Centralizes the convention so
 * a tag colored differently across screens stays consistent. Returns
 * "default" for anything unrecognized.
 */
export function tagToneFor(tag: string): TagTone {
  const t = tag.toLowerCase();
  if (t === "vegetarian" || t === "vegan") return "veg";
  if (t === "gluten-free" || t === "dairy-free") return "gf";
  if (t === "birthday" || t === "dessert") return "dessert";
  return "default";
}
