import type { RecipeInput } from "./recipe";

// Build a deduped lowercase token array from title + ingredients.
// Queried via Firestore array-contains-any in the recipe list. Keep this
// helper as the single source of truth — every recipe write must call it.
export function buildSearchTokens(input: RecipeInput): string[] {
  const tokens = new Set<string>();

  for (const word of tokenize(input.title)) tokens.add(word);

  for (const section of input.ingredients) {
    if (section.heading) {
      for (const w of tokenize(section.heading)) tokens.add(w);
    }
    for (const item of section.items) {
      for (const w of tokenize(item)) tokens.add(w);
    }
  }

  return Array.from(tokens);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}
