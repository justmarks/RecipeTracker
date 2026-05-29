import { describe, it, expect } from "vitest";
import {
  extractRecipeJsonLd,
  collectRecipeNodes,
  deepUnescape,
} from "../importFromUrl.js";

describe("extractRecipeJsonLd", () => {
  it("returns null for HTML with no JSON-LD", () => {
    expect(extractRecipeJsonLd("<html><body>No recipe</body></html>")).toBeNull();
  });

  it("returns null for JSON-LD that has no Recipe type", () => {
    const html = `<script type="application/ld+json">{"@type":"Article","name":"Test"}</script>`;
    expect(extractRecipeJsonLd(html)).toBeNull();
  });

  it("extracts a bare Recipe object", () => {
    const recipe = { "@type": "Recipe", name: "Pasta" };
    const html = `<script type="application/ld+json">${JSON.stringify(recipe)}</script>`;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed["@type"]).toBe("Recipe");
    expect(parsed.name).toBe("Pasta");
  });

  it("extracts a Recipe from an @graph wrapper", () => {
    const graph = {
      "@graph": [
        { "@type": "Article" },
        { "@type": "Recipe", name: "Cake" },
      ],
    };
    const html = `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed["@type"]).toBe("Recipe");
  });

  it("returns array JSON when multiple Recipe blocks are found", () => {
    const r1 = { "@type": "Recipe", name: "Recipe 1" };
    const r2 = { "@type": "Recipe", name: "Recipe 2" };
    const html =
      `<script type="application/ld+json">${JSON.stringify(r1)}</script>` +
      `<script type="application/ld+json">${JSON.stringify(r2)}</script>`;
    const result = extractRecipeJsonLd(html);
    const parsed = JSON.parse(result!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("handles Recipe type as an array of strings", () => {
    const recipe = { "@type": ["Recipe", "Product"], name: "Fusion" };
    const html = `<script type="application/ld+json">${JSON.stringify(recipe)}</script>`;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.name).toBe("Fusion");
  });

  it("skips invalid JSON without throwing", () => {
    const html = `<script type="application/ld+json">{invalid json}</script>`;
    expect(() => extractRecipeJsonLd(html)).not.toThrow();
    expect(extractRecipeJsonLd(html)).toBeNull();
  });

  it("is case-insensitive for the script type attribute", () => {
    const recipe = { "@type": "Recipe", name: "Test" };
    const html = `<SCRIPT TYPE="application/ld+json">${JSON.stringify(recipe)}</SCRIPT>`;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
  });
});

describe("collectRecipeNodes", () => {
  it("pushes a bare Recipe object into out", () => {
    const out: unknown[] = [];
    collectRecipeNodes({ "@type": "Recipe", name: "Pasta" }, out);
    expect(out).toHaveLength(1);
  });

  it("ignores non-Recipe objects", () => {
    const out: unknown[] = [];
    collectRecipeNodes({ "@type": "Article" }, out);
    expect(out).toHaveLength(0);
  });

  it("handles @graph wrapper", () => {
    const out: unknown[] = [];
    collectRecipeNodes(
      { "@graph": [{ "@type": "Recipe" }, { "@type": "Article" }] },
      out,
    );
    expect(out).toHaveLength(1);
  });

  it("handles top-level array", () => {
    const out: unknown[] = [];
    collectRecipeNodes(
      [{ "@type": "Recipe", name: "A" }, { "@type": "Recipe", name: "B" }],
      out,
    );
    expect(out).toHaveLength(2);
  });

  it("accepts type as array of strings containing Recipe", () => {
    const out: unknown[] = [];
    collectRecipeNodes({ "@type": ["Recipe", "Product"] }, out);
    expect(out).toHaveLength(1);
  });

  it("ignores null and primitive values", () => {
    const out: unknown[] = [];
    collectRecipeNodes(null, out);
    collectRecipeNodes(42, out);
    collectRecipeNodes("string", out);
    expect(out).toHaveLength(0);
  });
});

describe("deepUnescape", () => {
  it("leaves plain strings untouched", () => {
    expect(deepUnescape("hello world")).toBe("hello world");
  });

  it("converts \\n escape sequence to newline", () => {
    expect(deepUnescape("line1\\nline2")).toBe("line1\nline2");
  });

  it("converts \\t escape sequence to tab", () => {
    expect(deepUnescape("col1\\tcol2")).toBe("col1\tcol2");
  });

  it("converts \\'  to apostrophe", () => {
    expect(deepUnescape("it\\'s")).toBe("it's");
  });

  it("converts \\\" to double-quote", () => {
    expect(deepUnescape('say \\"hello\\"')).toBe('say "hello"');
  });

  it("converts \\\\ to single backslash", () => {
    expect(deepUnescape("back\\\\slash")).toBe("back\\slash");
  });

  it("removes \\r", () => {
    expect(deepUnescape("line1\\rline2")).toBe("line1line2");
  });

  it("recurses into arrays", () => {
    const result = deepUnescape(["hello\\nworld", "foo"]) as string[];
    expect(result[0]).toBe("hello\nworld");
    expect(result[1]).toBe("foo");
  });

  it("recurses into objects", () => {
    const result = deepUnescape({ title: "My\\nRecipe", notes: "tip\\nhere" }) as Record<string, string>;
    expect(result.title).toBe("My\nRecipe");
    expect(result.notes).toBe("tip\nhere");
  });

  it("passes through numbers and booleans unchanged", () => {
    expect(deepUnescape(42)).toBe(42);
    expect(deepUnescape(true)).toBe(true);
    expect(deepUnescape(null)).toBeNull();
  });
});
