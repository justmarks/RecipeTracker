import { z } from "zod";

export const CATEGORIES = ["appetizer", "side", "sauce", "soup", "salad", "entree"] as const;
export type Category = (typeof CATEGORIES)[number];

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
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
