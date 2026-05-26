import { CATEGORIES } from "shared";
import type { Category, RecipeInput, RecipeSource, Section } from "shared";

/**
 * Best-effort markdown → Partial<RecipeInput> parser. Convention:
 *
 *   # Title
 *   Source: https://example.com   (or "Book Title by Author, p. 42")
 *   Yield: 4 servings
 *   Prep: 20 min
 *   Cook: 40 min
 *   Total: 1 hr
 *   Tags: vegetarian, gluten-free
 *   Category: entree
 *
 *   ## Ingredients
 *   - 1 cup flour
 *   - 2 eggs
 *
 *   ### Frosting
 *   - 1 cup sugar
 *
 *   ## Instructions
 *   1. Mix flour and eggs
 *   2. Bake at 350F
 *
 *   ## Notes
 *   Free-form text here.
 *
 * Anything not recognized lands as empty so the user can fill in via
 * the form. Sections recognized: ingredients/instructions/directions/
 * steps/method/notes.
 */
export function parseMarkdown(text: string): Partial<RecipeInput> {
  const result: Partial<RecipeInput> = {};
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i++;

  // Title — first H1 (single #)
  if (i < lines.length) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) {
      result.title = m[1].trim();
      i++;
    }
  }

  // Metadata block — Key: value lines until the first ## section
  while (i < lines.length && !/^##\s/.test(lines[i])) {
    const m = lines[i].match(/^([A-Za-z][A-Za-z ]+):\s*(.+?)\s*$/);
    if (m) applyMetadata(result, m[1].trim().toLowerCase(), m[2].trim());
    i++;
  }

  // Top-level ## sections
  while (i < lines.length) {
    const sec = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!sec) {
      i++;
      continue;
    }
    const name = sec[1].toLowerCase().trim();
    i++;

    const body: string[] = [];
    while (i < lines.length && !/^##\s/.test(lines[i])) {
      body.push(lines[i]);
      i++;
    }

    if (name === "ingredients" || name.startsWith("ingredient")) {
      result.ingredients = parseListSections(body);
    } else if (
      name === "instructions" ||
      name.startsWith("instruction") ||
      name === "directions" ||
      name === "steps" ||
      name === "method"
    ) {
      result.instructions = parseListSections(body);
    } else if (name === "notes" || name === "note") {
      result.notes = body.join("\n").trim() || undefined;
    }
  }

  return result;
}

function applyMetadata(out: Partial<RecipeInput>, key: string, value: string): void {
  switch (key) {
    case "source":
    case "url":
    case "from":
      out.source = parseSource(value);
      return;
    case "yield":
    case "servings":
    case "serves":
      out.yield = value;
      return;
    case "prep":
    case "prep time":
      out.prepTime = value;
      return;
    case "cook":
    case "cook time":
      out.cookTime = value;
      return;
    case "total":
    case "total time":
      out.totalTime = value;
      return;
    case "tags": {
      const tags = value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tags.length > 0) out.tags = tags;
      return;
    }
    case "category": {
      const c = value.toLowerCase() as Category;
      if ((CATEGORIES as readonly string[]).includes(c)) out.category = c;
      return;
    }
  }
}

function parseSource(value: string): RecipeSource | undefined {
  if (/^https?:\/\//i.test(value)) {
    return { type: "url", url: value };
  }
  // "Book Title by Author, p. 42" — all parts optional except title.
  const m = value.match(/^(.+?)(?:\s+by\s+(.+?))?(?:,\s*p\.?\s*(.+))?$/i);
  if (!m || !m[1].trim()) return undefined;
  const source: RecipeSource = { type: "book", title: m[1].trim() };
  if (m[2]) source.author = m[2].trim();
  if (m[3]) source.page = m[3].trim();
  return source;
}

function parseListSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // ### Subheading → new sub-section
    const sub = line.match(/^###\s+(.+?)\s*$/);
    if (sub) {
      if (current && current.items.length > 0) sections.push(current);
      current = { heading: sub[1].trim(), items: [] };
      continue;
    }

    // Markdown list item (-, *, +, or numbered)
    const item = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (item) {
      if (!current) current = { heading: null, items: [] };
      current.items.push(item[1].trim());
      continue;
    }

    // Fallback: take any non-empty line as an item
    if (!current) current = { heading: null, items: [] };
    current.items.push(line);
  }

  if (current && current.items.length > 0) sections.push(current);
  return sections;
}
