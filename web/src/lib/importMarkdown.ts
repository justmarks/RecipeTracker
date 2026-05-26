import type { RecipeInput, RecipeSource, Section } from "shared";

/**
 * Best-effort markdown → Partial<RecipeInput> parser. Handles a range of
 * real-world recipe formats, not just clean "## Ingredients" / "## Instructions"
 * markdown. Falls back gracefully — any field not detected just stays empty
 * and the user can fill it in on the review form.
 *
 * Detects:
 *   - # Title  → title (first H1)
 *   - Section headers (with or without "##"):
 *       Ingredients / What You'll Need
 *       Directions / Instructions / Steps / Method / Preparation
 *       Notes / Tips
 *   - Sub-section headings inside Ingredients/Instructions:
 *       "## Frosting", "### Cake", or unmarked lines like "For the Sauce:"
 *       (heuristic: an unmarked line among bulleted/numbered items)
 *   - Source: "From <URL>", "Source: URL", "URL: ..."
 *   - Metadata in the head: Key: value pairs for Yield, Prep, Cook, Total,
 *     Tags, Category
 *   - Items are extracted whether they're bulleted ("-", "*", "•"), numbered
 *     ("1.", "1)"), or just one-per-line / one-per-paragraph
 */
export function parseMarkdown(text: string): Partial<RecipeInput> {
  const result: Partial<RecipeInput> = {};
  const lines = text.split(/\r?\n/);

  // ---- Title (first H1) ----
  const titleIdx = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (titleIdx >= 0) {
    result.title = lines[titleIdx].replace(/^#\s+/, "").trim();
    lines[titleIdx] = "";
  }

  // ---- Source URL (anywhere) ----
  for (let i = 0; i < lines.length; i++) {
    const url = matchSourceUrl(lines[i]);
    if (url) {
      result.source = { type: "url", url };
      lines[i] = "";
      break;
    }
  }

  // ---- Section header indices ----
  let ingredientsHeader = -1;
  let instructionsHeader = -1;
  let notesHeader = -1;

  for (let i = 0; i < lines.length; i++) {
    const head = headerText(lines[i]);
    if (head === null) continue;
    if (
      ingredientsHeader < 0 &&
      /^(ingredients?|what you('?ll)? need)$/.test(head)
    ) {
      ingredientsHeader = i;
    } else if (
      instructionsHeader < 0 &&
      /^(directions?|instructions?|steps?|method|preparation|to (make|prepare))$/.test(
        head,
      )
    ) {
      instructionsHeader = i;
    } else if (notesHeader < 0 && /^(notes?|tips?)$/.test(head)) {
      notesHeader = i;
    }
  }

  // ---- Metadata block (between title and first section header) ----
  const headStart = titleIdx >= 0 ? titleIdx + 1 : 0;
  const headEnd = Math.min(
    ingredientsHeader >= 0 ? ingredientsHeader : Infinity,
    instructionsHeader >= 0 ? instructionsHeader : Infinity,
    notesHeader >= 0 ? notesHeader : Infinity,
    lines.length,
  );
  for (let i = headStart; i < headEnd; i++) {
    const m = lines[i].match(/^([A-Za-z][A-Za-z '-]+):\s*(.+?)\s*$/);
    if (m && applyMetadata(result, m[1].trim().toLowerCase(), m[2].trim())) {
      lines[i] = "";
    }
  }

  // ---- Ingredients slice ----
  // If no ingredients header but there's an instructions header, ingredients
  // are everything between the title (+ metadata) and the instructions header.
  const ingStart =
    ingredientsHeader >= 0 ? ingredientsHeader + 1 : headStart;
  const ingEnd =
    instructionsHeader >= 0
      ? instructionsHeader
      : notesHeader >= 0
        ? notesHeader
        : lines.length;
  if (ingStart < ingEnd) {
    const parsed = parseItemsWithSubsections(lines.slice(ingStart, ingEnd));
    if (parsed.length > 0) result.ingredients = parsed;
  }

  // ---- Instructions slice ----
  if (instructionsHeader >= 0) {
    const instEnd = notesHeader >= 0 ? notesHeader : lines.length;
    const parsed = parseItemsWithSubsections(
      lines.slice(instructionsHeader + 1, instEnd),
    );
    if (parsed.length > 0) result.instructions = parsed;
  }

  // ---- Notes ----
  if (notesHeader >= 0) {
    const notesText = lines
      .slice(notesHeader + 1)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (notesText) result.notes = notesText;
  }

  return result;
}

/** Strip leading "#" markers and "**" bolding, lowercase, trim trailing ":" */
function headerText(line: string): string | null {
  const raw = line.trim();
  if (!raw) return null;
  // Strip leading #, bold markers, trailing colon — keep what's left.
  const cleaned = raw
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.+?)\*\*$/, "$1")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
  // Header lines are short (a few words) — long lines aren't headers.
  if (cleaned.length === 0 || cleaned.length > 60) return null;
  // Skip if it looks like a list item or sentence (has a comma + space, or
  // is multi-clause). Headers are typically 1-4 words.
  if (cleaned.split(/\s+/).length > 6) return null;
  return cleaned;
}

function matchSourceUrl(line: string): string | null {
  const trimmed = line.trim();
  // "From <URL>", "Source: URL", "URL: ..."
  const m = trimmed.match(
    /^(?:from|source|url)\s*:?\s*<?(https?:\/\/[^\s>]+)>?\s*$/i,
  );
  return m ? m[1] : null;
}

function applyMetadata(
  out: Partial<RecipeInput>,
  key: string,
  value: string,
): boolean {
  switch (key) {
    case "source":
    case "url":
    case "from":
      out.source = parseSource(value);
      return true;
    case "yield":
    case "servings":
    case "serves":
      out.yield = value;
      return true;
    case "prep":
    case "prep time":
      out.prepTime = value;
      return true;
    case "cook":
    case "cook time":
      out.cookTime = value;
      return true;
    case "total":
    case "total time":
      out.totalTime = value;
      return true;
    case "tags": {
      const tags = value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tags.length > 0) out.tags = tags;
      return true;
    }
    case "category": {
      const c = value.trim().toLowerCase();
      if (c) out.category = c;
      return true;
    }
    default:
      return false;
  }
}

function parseSource(value: string): RecipeSource | undefined {
  if (/^https?:\/\//i.test(value)) {
    return { type: "url", url: value };
  }
  const m = value.match(/^(.+?)(?:\s+by\s+(.+?))?(?:,\s*p\.?\s*(.+))?$/i);
  if (!m || !m[1].trim()) return undefined;
  const source: RecipeSource = { type: "book", title: m[1].trim() };
  if (m[2]) source.author = m[2].trim();
  if (m[3]) source.page = m[3].trim();
  return source;
}

function parseItemsWithSubsections(lines: string[]): Section[] {
  // Drop blanks; classify each remaining line as "had a marker" or "plain".
  const classified = lines
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const stripped = stripListMarker(raw);
      return { hadMarker: stripped !== raw, text: stripped };
    });
  if (classified.length === 0) return [];

  // Heuristic: if ANY line was bulleted/numbered, treat unmarked lines as
  // sub-section headings. This catches "For the Artichokes" and
  // "For the Dipping Sauce:" sitting between bulleted ingredient groups.
  const anyMarkers = classified.some((c) => c.hadMarker);

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of classified) {
    const explicit = line.text.match(/^#{1,3}\s+(.+?):?$/);
    // Sub-heading heuristic only applies to short-ish unmarked lines among
    // marked items. A long paragraph between bullets is more likely a body
    // line than a heading.
    const isHeuristicHeading =
      anyMarkers &&
      !line.hadMarker &&
      !explicit &&
      line.text.length <= 60 &&
      line.text.split(/\s+/).length <= 8;

    if (explicit || isHeuristicHeading) {
      if (current && current.items.length > 0) sections.push(current);
      const heading = explicit
        ? explicit[1].trim()
        : line.text.replace(/:$/, "").trim();
      current = { heading, items: [] };
    } else {
      if (!current) current = { heading: null, items: [] };
      current.items.push(line.text);
    }
  }
  if (current && current.items.length > 0) sections.push(current);
  return sections;
}

function stripListMarker(line: string): string {
  return line
    .trim()
    .replace(/^[•\-*–—·]\s+/, "")
    .trim()
    .replace(/^\(?\d+[.)]\s+/, "")
    .trim();
}
