import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../importMarkdown";

describe("parseMarkdown — title", () => {
  it("extracts H1 as title", () => {
    expect(parseMarkdown("# Chocolate Cake\n").title).toBe("Chocolate Cake");
  });

  it("uses the first H1 only", () => {
    expect(parseMarkdown("# First\n# Second\n").title).toBe("First");
  });

  it("returns no title when there is no H1", () => {
    expect(parseMarkdown("## Ingredients\n- flour\n").title).toBeUndefined();
  });

  it("strips the leading # and trims whitespace", () => {
    expect(parseMarkdown("#  Spaced Out  \n").title).toBe("Spaced Out");
  });
});

describe("parseMarkdown — ingredients and instructions", () => {
  const basicRecipe = `# Cake
## Ingredients
- 1 cup flour
- 2 eggs

## Instructions
1. Mix flour and eggs.
2. Bake at 350°F.
`;

  it("parses a basic ingredients section", () => {
    const r = parseMarkdown(basicRecipe);
    expect(r.ingredients).toHaveLength(1);
    expect(r.ingredients![0].heading).toBeNull();
    expect(r.ingredients![0].items).toContain("1 cup flour");
    expect(r.ingredients![0].items).toContain("2 eggs");
  });

  it("parses a basic instructions section", () => {
    const r = parseMarkdown(basicRecipe);
    expect(r.instructions).toHaveLength(1);
    expect(r.instructions![0].items).toContain("Mix flour and eggs.");
    expect(r.instructions![0].items).toContain("Bake at 350°F.");
  });

  it("strips bullet markers (-, *, •) from ingredient items", () => {
    const r = parseMarkdown(
      "## Ingredients\n- 1 cup flour\n* 2 eggs\n• salt\n",
    );
    const items = r.ingredients![0].items;
    expect(items).toContain("1 cup flour");
    expect(items).toContain("2 eggs");
    expect(items).toContain("salt");
  });

  it("strips numbered markers from instruction items", () => {
    const r = parseMarkdown(
      "## Ingredients\n- flour\n## Instructions\n1. First step\n2. Second step\n",
    );
    const items = r.instructions![0].items;
    expect(items[0]).toBe("First step");
    expect(items[1]).toBe("Second step");
  });

  it("recognizes 'Directions' as instructions", () => {
    const r = parseMarkdown(
      "## Ingredients\n- flour\n## Directions\n1. Mix.\n",
    );
    expect(r.instructions).toBeDefined();
    expect(r.instructions![0].items).toContain("Mix.");
  });

  it("recognizes 'Steps' as instructions", () => {
    const r = parseMarkdown(
      "## Ingredients\n- flour\n## Steps\n1. Mix.\n",
    );
    expect(r.instructions).toBeDefined();
  });

  it("recognizes 'What You'll Need' as ingredients", () => {
    const r = parseMarkdown(
      "## What You'll Need\n- butter\n## Instructions\n1. Melt.\n",
    );
    expect(r.ingredients![0].items).toContain("butter");
  });
});

describe("parseMarkdown — sub-sections", () => {
  it("splits bold headings into sub-sections in ingredients", () => {
    const md = `# Cake
## Ingredients
**Cake**
- 1 cup flour

**Frosting**
- 1 cup butter
## Instructions
1. Bake.
`;
    const r = parseMarkdown(md);
    expect(r.ingredients).toHaveLength(2);
    expect(r.ingredients![0].heading).toBe("Cake");
    expect(r.ingredients![1].heading).toBe("Frosting");
    expect(r.ingredients![0].items).toContain("1 cup flour");
    expect(r.ingredients![1].items).toContain("1 cup butter");
  });

  it("splits hash sub-headings inside a section", () => {
    const md = `## Ingredients
### Sauce
- 1 cup tomatoes
### Pasta
- 200g spaghetti
## Instructions
1. Cook.
`;
    const r = parseMarkdown(md);
    expect(r.ingredients).toHaveLength(2);
    expect(r.ingredients![0].heading).toBe("Sauce");
    expect(r.ingredients![1].heading).toBe("Pasta");
  });
});

describe("parseMarkdown — metadata", () => {
  const withMeta = (key: string, val: string) =>
    `# Recipe\n${key}: ${val}\n## Ingredients\n- flour\n`;

  it("parses Prep time", () => {
    expect(parseMarkdown(withMeta("Prep", "15 min")).prepTime).toBe("15 min");
  });

  it("parses Prep Time (with space)", () => {
    expect(parseMarkdown(withMeta("Prep Time", "20 min")).prepTime).toBe(
      "20 min",
    );
  });

  it("parses Cook time", () => {
    expect(parseMarkdown(withMeta("Cook", "30 min")).cookTime).toBe("30 min");
  });

  it("parses Total time", () => {
    expect(parseMarkdown(withMeta("Total Time", "45 min")).totalTime).toBe(
      "45 min",
    );
  });

  it("parses Yield", () => {
    expect(parseMarkdown(withMeta("Yield", "4 servings")).yield).toBe(
      "4 servings",
    );
  });

  it("parses Servings as yield", () => {
    expect(parseMarkdown(withMeta("Servings", "6")).yield).toBe("6");
  });

  it("parses Category (lowercased)", () => {
    expect(parseMarkdown(withMeta("Category", "Dessert")).category).toBe(
      "dessert",
    );
  });

  it("parses Tags as array", () => {
    expect(parseMarkdown(withMeta("Tags", "vegan, gluten-free")).tags).toEqual([
      "vegan",
      "gluten-free",
    ]);
  });

  it("parses Rating (1–5)", () => {
    expect(parseMarkdown(withMeta("Rating", "4")).rating).toBe(4);
  });

  it("ignores Rating outside 1–5", () => {
    expect(parseMarkdown(withMeta("Rating", "6")).rating).toBeUndefined();
  });

  it("parses valid lastMadeDate", () => {
    expect(
      parseMarkdown(withMeta("Last Made", "2024-03-15")).lastMadeDate,
    ).toBe("2024-03-15");
  });

  it("ignores malformed lastMadeDate", () => {
    expect(
      parseMarkdown(withMeta("Last Made", "March 15 2024")).lastMadeDate,
    ).toBeUndefined();
  });
});

describe("parseMarkdown — source URL detection", () => {
  it("extracts source from 'From https://...'", () => {
    const r = parseMarkdown(
      "# R\nFrom https://example.com/recipe\n## Ingredients\n- flour\n",
    );
    expect(r.source).toEqual({ type: "url", url: "https://example.com/recipe" });
  });

  it("extracts source from 'Source: https://...'", () => {
    const r = parseMarkdown(
      "# R\nSource: https://example.com/recipe\n## Ingredients\n- flour\n",
    );
    expect(r.source).toEqual({ type: "url", url: "https://example.com/recipe" });
  });

  it("extracts source from 'URL: https://...'", () => {
    const r = parseMarkdown(
      "# R\nURL: https://example.com/recipe\n## Ingredients\n- flour\n",
    );
    expect(r.source).toEqual({ type: "url", url: "https://example.com/recipe" });
  });
});

describe("parseMarkdown — notes", () => {
  it("captures a Notes section", () => {
    const md = `# Recipe
## Ingredients
- flour
## Instructions
1. Mix.
## Notes
Be sure to sift the flour before measuring.
`;
    expect(parseMarkdown(md).notes).toContain("sift the flour");
  });

  it("captures a Tips section as notes", () => {
    const md = `## Ingredients\n- flour\n## Instructions\n1. Mix.\n## Tips\nStore in an airtight container.\n`;
    expect(parseMarkdown(md).notes).toContain("airtight container");
  });
});

describe("parseMarkdown — headerless fallback", () => {
  it("splits a bulleted list + prose block when there are no section headers", () => {
    const md = `# Simple Pancakes
- 1 cup flour
- 1 egg
- 1 cup milk

Mix all ingredients together. Cook on a hot griddle until golden.
`;
    const r = parseMarkdown(md);
    expect(r.ingredients).toBeDefined();
    expect(r.ingredients![0].items).toContain("1 cup flour");
    expect(r.instructions).toBeDefined();
    expect(r.instructions![0].items.join(" ")).toContain("griddle");
  });

  it("does not apply the fallback when no prose follows the bullets", () => {
    const md = `# Shopping List\n- apples\n- bananas\n`;
    const r = parseMarkdown(md);
    // No instructions header — the fallback should not fire (no prose after bullets)
    expect(r.instructions).toBeUndefined();
  });
});

describe("parseMarkdown — edge cases", () => {
  it("returns empty object for empty string", () => {
    expect(parseMarkdown("")).toEqual({});
  });

  it("returns empty object for whitespace only", () => {
    expect(parseMarkdown("   \n  \n")).toEqual({});
  });

  it("handles CRLF line endings", () => {
    const r = parseMarkdown("# Cake\r\n## Ingredients\r\n- flour\r\n");
    expect(r.title).toBe("Cake");
    expect(r.ingredients![0].items).toContain("flour");
  });
});
