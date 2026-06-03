import { describe, it, expect } from "vitest";
import {
  insertLink,
  prefixLines,
  wrapSelection,
} from "../PrepNotesEditor";

/**
 * Stand-in for the textarea slice the helpers care about — we feed
 * them an object with the same three fields rather than mounting a
 * real DOM, keeping the unit tests fast and jsdom-free.
 */
function ta(value: string, selStart: number, selEnd: number = selStart) {
  return { value, selectionStart: selStart, selectionEnd: selEnd };
}

describe("wrapSelection", () => {
  it("wraps a selection with the markers", () => {
    const patch = wrapSelection(ta("hello world", 6, 11), "**", "**", "x");
    expect(patch.value).toBe("hello **world**");
    // Selection lands on the original content so further typing replaces it.
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("world");
  });

  it("inserts placeholder when there's no selection", () => {
    const patch = wrapSelection(ta("hello ", 6), "**", "**", "bold");
    expect(patch.value).toBe("hello **bold**");
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("bold");
  });

  it("uses different markers for before/after when asked", () => {
    const patch = wrapSelection(ta("foo", 0, 3), "[", "](url)", "label");
    expect(patch.value).toBe("[foo](url)");
  });

  it("supports italic markers without colliding with bold", () => {
    const patch = wrapSelection(ta("word", 0, 4), "*", "*", "italic");
    expect(patch.value).toBe("*word*");
  });

  it("works at the start of the buffer", () => {
    const patch = wrapSelection(ta("", 0), "**", "**", "bold");
    expect(patch.value).toBe("**bold**");
    expect(patch.selStart).toBe(2);
    expect(patch.selEnd).toBe(6);
  });
});

describe("prefixLines", () => {
  it("prefixes a single line containing the caret", () => {
    const patch = prefixLines(ta("hello", 2), "## ");
    expect(patch.value).toBe("## hello");
  });

  it("prefixes every line a multi-line selection touches", () => {
    const src = "one\ntwo\nthree";
    // Selection from start of `two` to inside `three`.
    const patch = prefixLines(ta(src, 4, 11), "- ");
    expect(patch.value).toBe("one\n- two\n- three");
  });

  it("includes the first line when caret is at column 0", () => {
    const patch = prefixLines(ta("first\nsecond", 0, 7), "1. ");
    expect(patch.value).toBe("1. first\n1. second");
  });

  it("treats the file-end line correctly when no trailing newline", () => {
    const patch = prefixLines(ta("alpha", 5), "- [ ] ");
    expect(patch.value).toBe("- [ ] alpha");
  });

  it("leaves blank intermediate lines untouched", () => {
    // Multi-paragraph selection: blanks shouldn't get the prefix.
    const src = "first\n\nsecond";
    const patch = prefixLines(ta(src, 0, src.length), "- ");
    expect(patch.value).toBe("- first\n\n- second");
  });

  it("inserts the prefix on a solo empty buffer (regression)", () => {
    // The previous implementation skipped empty lines unconditionally,
    // so clicking Bullet on a fresh empty textarea was a no-op.
    const patch = prefixLines(ta("", 0), "- ");
    expect(patch.value).toBe("- ");
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("- ");
  });

  it("inserts the prefix when caret sits on an empty line within content", () => {
    // Single-line "selection" on the blank middle line — user has
    // clicked into the gap and is starting a new list there.
    const src = "one\n\nthree";
    const patch = prefixLines(ta(src, 4), "- ");
    expect(patch.value).toBe("one\n- \nthree");
  });

  it("re-applies returns selection covering the modified block", () => {
    const patch = prefixLines(ta("alpha", 0, 5), "## ");
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("## alpha");
  });
});

describe("insertLink", () => {
  it("uses the selection as label and lands cursor on the url placeholder", () => {
    const patch = insertLink(ta("see docs", 4, 8));
    expect(patch.value).toBe("see [docs](url)");
    // Cursor lands on "url" so a paste replaces it directly.
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("url");
  });

  it("inserts placeholder text when there's no selection", () => {
    const patch = insertLink(ta("see ", 4));
    expect(patch.value).toBe("see [link text](url)");
    // Label is selected first since that's the more salient edit target.
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("link text");
  });

  it("works at the start of the buffer", () => {
    const patch = insertLink(ta("", 0));
    expect(patch.value).toBe("[link text](url)");
    expect(patch.value.slice(patch.selStart, patch.selEnd)).toBe("link text");
  });
});
