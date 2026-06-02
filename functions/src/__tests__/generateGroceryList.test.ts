import {describe, it, expect} from "vitest";
import {
  GROCERY_CATEGORIES,
  recipeToPromptBlock,
} from "../generateGroceryList.js";

describe("recipeToPromptBlock", () => {
  it("renders a single unheadeded section as plain bullets", () => {
    const block = recipeToPromptBlock("Pancakes", [
      {heading: null, items: ["2 cups flour", "1 tbsp sugar", "1 egg"]},
    ]);
    expect(block).not.toBeNull();
    expect(block!.title).toBe("Pancakes");
    // No `## Heading` line — the section had no heading. Items become
    // dash bullets so Claude sees the same format as the markdown
    // import flow.
    expect(block!.ingredientsBlock).toBe(
      "- 2 cups flour\n- 1 tbsp sugar\n- 1 egg",
    );
  });

  it("emits a ## heading per named section, items beneath", () => {
    const block = recipeToPromptBlock("Layered cake", [
      {heading: "Cake", items: ["2 cups flour"]},
      {heading: "Frosting", items: ["1 cup butter", "3 cups sugar"]},
    ]);
    expect(block!.ingredientsBlock).toBe(
      [
        "## Cake",
        "- 2 cups flour",
        "## Frosting",
        "- 1 cup butter",
        "- 3 cups sugar",
      ].join("\n"),
    );
  });

  it("returns null when ingredients is not an array", () => {
    // Defensive: stored recipes occasionally have missing or
    // corrupt fields. The function should skip rather than throw —
    // a single bad recipe shouldn't block the whole grocery build.
    expect(recipeToPromptBlock("X", null)).toBeNull();
    expect(recipeToPromptBlock("X", undefined)).toBeNull();
    expect(recipeToPromptBlock("X", "raw text")).toBeNull();
    expect(recipeToPromptBlock("X", 42)).toBeNull();
  });

  it("returns null when nothing usable was extracted", () => {
    // Sections with no headings AND no items produce zero lines.
    // The function returns null so the caller can skip the recipe
    // entirely rather than send Claude an empty prompt fragment.
    const block = recipeToPromptBlock("Empty", [
      {heading: null, items: []},
      {heading: null, items: []},
    ]);
    expect(block).toBeNull();
  });

  it("emits a heading-only block when a section has a heading but no items", () => {
    // We DO want to preserve the heading so Claude knows the recipe
    // referenced that subsection — useful when other sections add
    // content adjacent to it. The empty-section dropper above
    // catches the case where there's NOTHING usable in the recipe.
    const block = recipeToPromptBlock("Recipe", [
      {heading: "Garnish", items: []},
      {heading: null, items: ["1 lb flour"]},
    ]);
    expect(block!.ingredientsBlock).toContain("## Garnish");
    expect(block!.ingredientsBlock).toContain("- 1 lb flour");
  });

  it("skips items that aren't strings", () => {
    const block = recipeToPromptBlock("Mixed", [
      {
        heading: null,
        items: ["1 cup flour", 42, null, "1 egg", undefined],
      },
    ]);
    expect(block!.ingredientsBlock).toBe("- 1 cup flour\n- 1 egg");
  });

  it("skips items that are whitespace-only strings", () => {
    const block = recipeToPromptBlock("Mixed", [
      {heading: null, items: ["1 cup flour", "   ", "1 egg"]},
    ]);
    expect(block!.ingredientsBlock).toBe("- 1 cup flour\n- 1 egg");
  });

  it("trims whitespace from headings and items", () => {
    const block = recipeToPromptBlock("Trim", [
      {heading: "  Sauce  ", items: ["  1 cup tomatoes  "]},
    ]);
    expect(block!.ingredientsBlock).toBe("## Sauce\n- 1 cup tomatoes");
  });

  it("skips a heading that's empty or whitespace-only", () => {
    const block = recipeToPromptBlock("X", [
      {heading: "   ", items: ["1 cup flour"]},
    ]);
    // The whitespace-only heading is dropped; items still render
    // (no `## ` line in the output).
    expect(block!.ingredientsBlock).toBe("- 1 cup flour");
  });

  it("skips non-object section entries", () => {
    const block = recipeToPromptBlock("X", [
      null,
      "rogue string",
      {heading: null, items: ["1 cup flour"]},
    ]);
    expect(block!.ingredientsBlock).toBe("- 1 cup flour");
  });

  it("preserves the title verbatim", () => {
    const block = recipeToPromptBlock("Nana's “Best” Cake", [
      {heading: null, items: ["1 egg"]},
    ]);
    expect(block!.title).toBe("Nana's “Best” Cake");
  });
});

describe("GROCERY_CATEGORIES (function-side)", () => {
  it("stays aligned with the user-requested 10 buckets", () => {
    // The cloud function inlines this constant rather than importing
    // from shared/ (matches the importFromUrl tool-schema pattern).
    // This test pins the function's enum to the documented list so
    // a drift between the function tool schema and the shared schema
    // would surface immediately.
    expect(GROCERY_CATEGORIES).toEqual([
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
    ]);
  });
});
