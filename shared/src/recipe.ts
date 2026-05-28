import { z } from "zod";

// Default chapter list seeded for every new user. Stored lowercase; displayed
// with CSS capitalization. Users can rename, reorder, add, and delete via the
// chapter management UI — the schema accepts any non-empty string here.
export const DEFAULT_CHAPTERS = [
  "appetizer",
  "side",
  "sauce",
  "soup",
  "salad",
  "entree",
  "dessert"
] as const;

// Fallback chapter used when a chapter is deleted while recipes still live
// in it — those recipes get reassigned here instead of orphaned. The chapter
// is auto-added to the user's list on first need and can't be deleted itself.
export const UNCATEGORIZED_CHAPTER = "uncategorized";

/**
 * Favorites live in their own top-level collection at
 *   favorites/{uid}_{recipeId}
 * with a deterministic doc id so existence checks and toggles are O(1)
 * (mirrors the autoShares pattern). A favorite is per-user, not per-
 * recipe, so two users viewing the same shared recipe can favorite it
 * independently without touching the recipe doc.
 */
export const favoriteDocId = (uid: string, recipeId: string): string =>
  `${uid}_${recipeId}`;

export type Favorite = {
  uid: string;
  recipeId: string;
  createdAt: unknown; // Firestore Timestamp on read; serverTimestamp() on write
};

export const RecipeSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal("book"),
    title: z.string().min(1),
    author: z.string().optional(),
    page: z.string().optional(),
  }),
]);
export type RecipeSource = z.infer<typeof RecipeSourceSchema>;

export const SectionSchema = z.object({
  heading: z.string().nullable(),
  items: z.array(z.string().min(1)),
});
export type Section = z.infer<typeof SectionSchema>;

// Client-supplied recipe shape. Server-side fields (ownerId, sharedWith,
// searchTokens, createdAt, updatedAt) are added in the write path.
export const RecipeInputSchema = z.object({
  title: z.string().min(1).max(500),
  source: RecipeSourceSchema.optional(),
  ingredients: z.array(SectionSchema),
  instructions: z.array(SectionSchema),
  notes: z.string().optional(),
  yield: z.string().optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  category: z.string().min(1).max(100),
  tags: z.array(z.string()),
  photoUrl: z.string().url().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  lastMadeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
