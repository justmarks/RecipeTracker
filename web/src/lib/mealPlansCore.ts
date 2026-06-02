import type { Guest, GroceryList, PrepSection } from "shared";

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
export type ParsedMealPlan = {
  id: string;
  ownerId: string;
  name: string;
  notes?: string;
  guests: Guest[];
  recipeIds: string[];
  prepSections: PrepSection[];
  groceryList?: GroceryList;
  groceryListGeneratedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

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
    guests: Array.isArray(data.guests) ? (data.guests as Guest[]) : [],
    recipeIds: Array.isArray(data.recipeIds)
      ? (data.recipeIds as string[])
      : [],
    prepSections: Array.isArray(data.prepSections)
      ? (data.prepSections as PrepSection[])
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

/**
 * Allowed values for `Guest.type`. Kept here so the schema in shared/
 * and the UI form share a single source of truth.
 */
export const GUEST_TYPES = ["adult", "child"] as const;
export type GuestType = (typeof GUEST_TYPES)[number];
