import type {
  AdditionalItem,
  GuestGroup,
  GroceryList,
} from "shared";

/**
 * Pure helpers for the meal plan library. Kept separate from
 * mealPlans.ts so unit tests can import without dragging in the
 * firebase client SDK or React.
 */

/**
 * Stored meal-plan shape, normalized for client consumers. Mirrors the
 * recipes/{id} convention: ownerId stamped on every doc, ordered guest
 * + prep + recipe collections, optional grocery-list cache.
 *
 * createdAt / updatedAt / groceryListGeneratedAt are intentionally
 * `unknown` at this layer — the consumer module attaches the Firestore
 * Timestamp type. Tests don't need to construct timestamps.
 */
export type ParsedSharedWithDetail = { uid: string; email: string };

export type ParsedMealPlan = {
  id: string;
  ownerId: string;
  name: string;
  notes?: string;
  guests: GuestGroup[];
  recipeIds: string[];
  /**
   * Prep notes as markdown — empty string when the plan has none.
   * Legacy plans with the old `prepSections` array are converted to
   * markdown at parse time so the new editor can display them.
   */
  prepNotes: string;
  additionalItems: AdditionalItem[];
  /** ISO date (YYYY-MM-DD) for the meal occasion. Absent on older plans. */
  date?: string;
  /**
   * UIDs the owner has explicitly granted view access to. Mirrors the
   * recipe `sharedWith` array. Always present (defaults to `[]` for
   * plans created before sharing shipped) so the security-rule check
   * `request.auth.uid in resource.data.sharedWith` never trips on a
   * missing field.
   */
  sharedWith: string[];
  /**
   * Denormalized {uid, email} mirror of sharedWith so the share dialog
   * can render who has access without a separate Auth lookup per
   * render. Optional for back-compat with pre-sharing plans.
   */
  sharedWithDetails: ParsedSharedWithDetail[];
  groceryList?: GroceryList;
  groceryListGeneratedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

/**
 * Coerce the stored `guests` field into the new GuestGroup shape.
 *
 * Two cases:
 *   1. New shape — each entry has `adults`/`kids` numeric counts.
 *      Pass through unchanged.
 *   2. Legacy shape — each entry has `name` + `type: "adult"|"child"`.
 *      Tally totals and emit a single "Guests" group so the cook
 *      still sees their headcount until they migrate manually.
 *
 * Defensive: anything that isn't an array becomes an empty list.
 */
export function parseGuestField(value: unknown): GuestGroup[] {
  if (!Array.isArray(value)) return [];
  if (value.length === 0) return [];

  // Detect legacy shape: every item has `type` and lacks `adults`.
  const isLegacy = value.every(
    (v) =>
      v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).type === "string" &&
      typeof (v as Record<string, unknown>).adults !== "number",
  );
  if (isLegacy) {
    let adults = 0;
    let kids = 0;
    for (const g of value) {
      const t = (g as { type?: unknown }).type;
      if (t === "adult") adults++;
      else if (t === "child") kids++;
    }
    if (adults === 0 && kids === 0) return [];
    return [{ id: "_legacy_guests", name: "Guests", adults, kids }];
  }

  // New shape — trust the stored values (defensive cast keeps non-
  // numeric counts from crashing the page later).
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        v != null && typeof v === "object",
    )
    .map((v) => ({
      id: typeof v.id === "string" && v.id ? v.id : "guest_unknown",
      name: typeof v.name === "string" ? v.name : "",
      adults: typeof v.adults === "number" ? v.adults : 0,
      kids: typeof v.kids === "number" ? v.kids : 0,
    }));
}

/**
 * Render legacy PrepSection[] as markdown so the new prep-notes
 * editor can pick up where the structured editor left off. Each
 * section becomes a level-2 heading; each item becomes a task-list
 * row (`- [x]` for done, `- [ ]` for not done). Empty headings and
 * empty items are skipped to avoid clutter.
 */
export function prepSectionsToMarkdown(sections: unknown): string {
  if (!Array.isArray(sections)) return "";
  const lines: string[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const heading = (section as { heading?: unknown }).heading;
    const items = (section as { items?: unknown }).items;
    if (typeof heading === "string" && heading.trim()) {
      if (lines.length > 0) lines.push("");
      lines.push(`## ${heading.trim()}`);
    }
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const text = (it as { text?: unknown }).text;
        const done = (it as { done?: unknown }).done;
        if (typeof text !== "string" || !text.trim()) continue;
        lines.push(`- [${done === true ? "x" : " "}] ${text.trim()}`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Project a Firestore doc snapshot's data into a ParsedMealPlan,
 * coercing legacy / partial shapes into safe defaults. Back-compat
 * matters here because:
 *
 * - Plans created before the prep list shipped have no `prepSections`
 *   field (defaults to `[]`).
 * - Plans created before the grocery list shipped have no
 *   `groceryList` / `groceryListGeneratedAt` (omitted).
 * - Malformed array fields (e.g., `guests` written as an object)
 *   degrade to an empty list rather than crashing the page.
 */
export function parseMealPlanDoc(
  id: string,
  data: Record<string, unknown>,
): ParsedMealPlan {
  const groceryRaw = data.groceryList as { items?: unknown } | undefined;
  const groceryList: GroceryList | undefined =
    groceryRaw && Array.isArray(groceryRaw.items)
      ? { items: groceryRaw.items as GroceryList["items"] }
      : undefined;
  const notesRaw = data.notes;
  return {
    id,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    name: typeof data.name === "string" ? data.name : "",
    notes:
      typeof notesRaw === "string" && notesRaw.length > 0
        ? notesRaw
        : undefined,
    guests: parseGuestField(data.guests),
    recipeIds: Array.isArray(data.recipeIds)
      ? (data.recipeIds as string[])
      : [],
    // Prefer the new markdown field when present. If only the legacy
    // structured prepSections survives, render it to markdown so the
    // new editor picks up the user's existing checklist.
    prepNotes:
      typeof data.prepNotes === "string" && data.prepNotes.length > 0
        ? data.prepNotes
        : prepSectionsToMarkdown(data.prepSections),
    additionalItems: Array.isArray(data.additionalItems)
      ? (data.additionalItems as AdditionalItem[])
      : [],
    date:
      typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
        ? data.date
        : undefined,
    sharedWith: Array.isArray(data.sharedWith)
      ? (data.sharedWith as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
    sharedWithDetails: Array.isArray(data.sharedWithDetails)
      ? (data.sharedWithDetails as unknown[]).flatMap((v) => {
          if (!v || typeof v !== "object") return [];
          const rec = v as Record<string, unknown>;
          if (typeof rec.uid !== "string" || typeof rec.email !== "string") {
            return [];
          }
          return [{ uid: rec.uid, email: rec.email }];
        })
      : [],
    groceryList,
    groceryListGeneratedAt: data.groceryListGeneratedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Generate a stable, client-side id used by the guest + prep editors.
 * Uses `crypto.randomUUID` when available (every browser shipping in
 * 2024+) and falls back to a timestamp + random suffix for older
 * Safari and node test environments where the API may be missing.
 *
 * Exported through the consumer module as `newGuestId` and
 * `newPrepId` — the names there describe intent at the call site,
 * this name describes implementation.
 */
export function newClientId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

