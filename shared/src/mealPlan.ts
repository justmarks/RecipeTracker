import { z } from "zod";

/**
 * Meal plans group a set of recipes around a single occasion — a
 * Thanksgiving menu, a Friday night dinner, a kids' birthday. Each plan
 * carries its own guest list (with adult/child breakdown so the cook
 * can scale yields and plan portions) and freeform notes.
 *
 * The plan stores `recipeIds` only; titles and photos are resolved
 * at render time against the user's live `useRecipeList` stream. That
 * avoids the stale-denormalized-title problem when a recipe is renamed
 * and keeps the meal plan doc small.
 *
 * Sharing is owner-scoped for now — the plan lives in mealPlans/{id}
 * and only the owner can read or write it. A recipe inside a plan may
 * itself be shared with the owner (explicit or auto-share); resolving
 * via useRecipeList picks up those entries automatically.
 */

export const GuestSchema = z.object({
  // Stable client-generated id so React keys + delete-by-id work
  // without index churn when guests are added or removed.
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(["adult", "child"]),
});
export type Guest = z.infer<typeof GuestSchema>;

/**
 * A single TODO entry inside a prep section. Text can be empty during
 * editing (the UI shows placeholder copy); persistence keeps whatever
 * the user typed so the row survives a refresh mid-edit. `done` flips
 * when the user checks the box; printing renders it as ☑ vs ☐.
 */
export const PrepItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(500),
  done: z.boolean(),
});
export type PrepItem = z.infer<typeof PrepItemSchema>;

/**
 * A prep-list section — typically a day header ("Day before",
 * "Wednesday morning", "Day of") that groups TODO items. Sections are
 * freeform per-plan; we don't impose a calendar model so the user can
 * organize however they think about the cook.
 */
export const PrepSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().max(120),
  items: z.array(PrepItemSchema),
});
export type PrepSection = z.infer<typeof PrepSectionSchema>;

/**
 * The ten shopping categories the user requested. Stored as a kebab-
 * case slug so the enum survives display-label changes. Order matters
 * — sections render in this order on the grocery list page, top to
 * bottom following the rough "perishables first / pantry last" trip
 * pattern the user wrote out.
 */
export const GROCERY_CATEGORIES = [
  "fruits",
  "vegetables",
  "meats",
  "dairy",
  "cheeses",
  "baking-and-dry-goods",
  "bread-and-crackers",
  "beverages",
  "paper-goods",
  "misc",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

/**
 * Human-readable category headings — keep aligned with GROCERY_CATEGORIES
 * for the strict-enum lookup the UI uses when rendering section headers
 * and the print layout.
 */
export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  "fruits": "Fruits",
  "vegetables": "Vegetables",
  "meats": "Meats",
  "dairy": "Dairy",
  "cheeses": "Cheeses",
  "baking-and-dry-goods": "Baking and Dry Goods",
  "bread-and-crackers": "Bread and Crackers",
  "beverages": "Beverages",
  "paper-goods": "Paper Goods",
  "misc": "Misc",
};

export const GroceryItemSchema = z.object({
  /**
   * Shopping line as it should appear on the printed list — e.g.,
   * "Yellow onions (3 medium)" or "All-purpose flour (3 cups total)".
   * Quantity + name combined into one shopper-friendly string so the
   * cart can be checked off without parsing.
   */
  text: z.string().min(1).max(280),
  category: z.enum(GROCERY_CATEGORIES),
});
export type GroceryItem = z.infer<typeof GroceryItemSchema>;

export const GroceryListSchema = z.object({
  items: z.array(GroceryItemSchema),
});
export type GroceryList = z.infer<typeof GroceryListSchema>;

export const MealPlanInputSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().optional(),
  guests: z.array(GuestSchema),
  recipeIds: z.array(z.string().min(1)),
  // Optional for back-compat — meal plans created before the prep
  // list shipped don't carry the field. The UI defaults to [] on read.
  prepSections: z.array(PrepSectionSchema).optional(),
});
export type MealPlanInput = z.infer<typeof MealPlanInputSchema>;
