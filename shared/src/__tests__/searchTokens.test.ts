import { describe, it, expect } from "vitest";
import { buildSearchTokens } from "../searchTokens";
import type { RecipeInput } from "../recipe";

function makeInput(
  title: string,
  ingredients: RecipeInput["ingredients"] = [],
): RecipeInput {
  return { title, ingredients, instructions: [], category: "entree", tags: [] };
}

describe("buildSearchTokens", () => {
  it("tokenizes title words into lowercase", () => {
    const tokens = buildSearchTokens(makeInput("Chocolate Cake"));
    expect(tokens).toContain("chocolate");
    expect(tokens).toContain("cake");
  });

  it("lowercases all tokens", () => {
    const tokens = buildSearchTokens(makeInput("BBQ Chicken"));
    expect(tokens).toContain("bbq");
    expect(tokens).toContain("chicken");
    expect(tokens).not.toContain("BBQ");
  });

  it("deduplicates tokens across title and ingredients", () => {
    const tokens = buildSearchTokens(
      makeInput("Chocolate Cake", [
        { heading: null, items: ["chocolate chips"] },
      ]),
    );
    expect(tokens.filter((t) => t === "chocolate")).toHaveLength(1);
  });

  it("tokenizes ingredient items", () => {
    const tokens = buildSearchTokens(
      makeInput("Cake", [
        { heading: null, items: ["2 cups flour", "1 tsp vanilla extract"] },
      ]),
    );
    expect(tokens).toContain("flour");
    expect(tokens).toContain("vanilla");
    expect(tokens).toContain("extract");
  });

  it("tokenizes section headings", () => {
    const tokens = buildSearchTokens(
      makeInput("Cake", [{ heading: "Frosting", items: ["butter"] }]),
    );
    expect(tokens).toContain("frosting");
    expect(tokens).toContain("butter");
  });

  it("handles null section heading without error", () => {
    expect(() =>
      buildSearchTokens(
        makeInput("Test", [{ heading: null, items: ["flour"] }]),
      ),
    ).not.toThrow();
  });

  it("filters tokens shorter than 2 characters", () => {
    const tokens = buildSearchTokens(makeInput("a b c go longer"));
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("b");
    expect(tokens).not.toContain("c");
    expect(tokens).toContain("go");
    expect(tokens).toContain("longer");
  });

  it("strips punctuation (apostrophes, exclamation, etc.)", () => {
    const tokens = buildSearchTokens(makeInput("Mom's Special Recipe!"));
    expect(tokens).toContain("mom");
    expect(tokens).toContain("special");
    expect(tokens).toContain("recipe");
    expect(tokens).not.toContain("mom's");
  });

  it("preserves hyphens inside words (e.g. gluten-free)", () => {
    // tokenize keeps '-' per [^a-z0-9\s-]+ pattern
    const tokens = buildSearchTokens(makeInput("Gluten-Free Pasta"));
    expect(tokens).toContain("gluten-free");
    expect(tokens).toContain("pasta");
  });

  it("returns empty array when all words are too short", () => {
    const tokens = buildSearchTokens(makeInput("a", []));
    expect(tokens).toEqual([]);
  });

  it("returns array of unique strings", () => {
    const tokens = buildSearchTokens(makeInput("Tomato Soup Tomato"));
    const unique = new Set(tokens);
    expect(unique.size).toBe(tokens.length);
  });
});
