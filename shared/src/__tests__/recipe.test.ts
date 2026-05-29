import { describe, it, expect } from "vitest";
import { favoriteDocId, RecipeInputSchema } from "../recipe";

describe("favoriteDocId", () => {
  it("concatenates uid and recipeId with underscore", () => {
    expect(favoriteDocId("user1", "recipe1")).toBe("user1_recipe1");
  });

  it("works with uid containing special chars", () => {
    expect(favoriteDocId("uid-abc.123", "rec")).toBe("uid-abc.123_rec");
  });

  it("produces unique ids for distinct pairs", () => {
    expect(favoriteDocId("a", "b")).not.toBe(favoriteDocId("b", "a"));
  });
});

describe("RecipeInputSchema", () => {
  const minimal = {
    title: "Test Recipe",
    ingredients: [],
    instructions: [],
    category: "entree",
    tags: [],
  };

  describe("title validation", () => {
    it("accepts a valid title", () => {
      expect(() => RecipeInputSchema.parse(minimal)).not.toThrow();
    });

    it("rejects empty title", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, title: "" }),
      ).toThrow();
    });

    it("rejects title over 500 characters", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, title: "a".repeat(501) }),
      ).toThrow();
    });

    it("accepts title of exactly 500 characters", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, title: "a".repeat(500) }),
      ).not.toThrow();
    });
  });

  describe("source validation", () => {
    it("accepts url source with valid https URL", () => {
      const result = RecipeInputSchema.parse({
        ...minimal,
        source: { type: "url", url: "https://example.com/recipe" },
      });
      expect(result.source).toEqual({
        type: "url",
        url: "https://example.com/recipe",
      });
    });

    it("accepts book source with title", () => {
      const result = RecipeInputSchema.parse({
        ...minimal,
        source: {
          type: "book",
          title: "Joy of Cooking",
          author: "Rombauer",
          page: "42",
        },
      });
      expect(result.source).toEqual({
        type: "book",
        title: "Joy of Cooking",
        author: "Rombauer",
        page: "42",
      });
    });

    it("accepts book source with title only", () => {
      expect(() =>
        RecipeInputSchema.parse({
          ...minimal,
          source: { type: "book", title: "Ottolenghi Simple" },
        }),
      ).not.toThrow();
    });

    it("rejects book source with empty title", () => {
      expect(() =>
        RecipeInputSchema.parse({
          ...minimal,
          source: { type: "book", title: "" },
        }),
      ).toThrow();
    });

    it("omitting source is valid", () => {
      expect(() => RecipeInputSchema.parse(minimal)).not.toThrow();
    });
  });

  describe("rating validation", () => {
    it.each([1, 2, 3, 4, 5])("accepts rating %i", (r) => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, rating: r }),
      ).not.toThrow();
    });

    it("rejects rating 0", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, rating: 0 }),
      ).toThrow();
    });

    it("rejects rating 6", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, rating: 6 }),
      ).toThrow();
    });

    it("rejects non-integer rating", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, rating: 3.5 }),
      ).toThrow();
    });
  });

  describe("lastMadeDate validation", () => {
    it("accepts YYYY-MM-DD format", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, lastMadeDate: "2024-01-15" }),
      ).not.toThrow();
    });

    it("rejects MM/DD/YYYY format", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, lastMadeDate: "01/15/2024" }),
      ).toThrow();
    });

    it("rejects plain year", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, lastMadeDate: "2024" }),
      ).toThrow();
    });
  });

  describe("photoUrl validation", () => {
    it("accepts https photo URL", () => {
      expect(() =>
        RecipeInputSchema.parse({
          ...minimal,
          photoUrl: "https://cdn.example.com/photo.jpg",
        }),
      ).not.toThrow();
    });

    it("rejects non-URL photoUrl", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, photoUrl: "not-a-url" }),
      ).toThrow();
    });
  });

  describe("category validation", () => {
    it("rejects empty category", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, category: "" }),
      ).toThrow();
    });

    it("rejects category over 100 characters", () => {
      expect(() =>
        RecipeInputSchema.parse({ ...minimal, category: "a".repeat(101) }),
      ).toThrow();
    });
  });
});
