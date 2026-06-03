import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPrepMarkdown, toggleTaskInSource } from "../prepMarkdown";

/**
 * Render the markdown to HTML for structural assertions. Using
 * renderToStaticMarkup keeps the test free of jsdom; we just need
 * the tree shape, not real DOM events.
 */
function html(md: string): string {
  return renderToStaticMarkup(<>{renderPrepMarkdown(md)}</>);
}

describe("renderPrepMarkdown — flat lists", () => {
  it("renders a simple bullet list", () => {
    const out = html("- One\n- Two");
    expect(out).toMatch(/<ul[^>]*>.*<li[^>]*>.*One.*<\/li>.*<li[^>]*>.*Two/s);
  });

  it("renders a numbered list", () => {
    const out = html("1. First\n2. Second");
    expect(out).toMatch(/<ol[^>]*>.*First.*Second/s);
  });

  it("renders task list items with a checkbox role", () => {
    const out = html("- [ ] Open\n- [x] Done");
    expect(out).toMatch(/role="checkbox"/);
    expect(out).toMatch(/aria-checked="false"/);
    expect(out).toMatch(/aria-checked="true"/);
  });
});

describe("renderPrepMarkdown — nested lists", () => {
  it("nests one level under a bullet parent", () => {
    const md = ["- Parent", "  - Child"].join("\n");
    const out = html(md);
    // The nested ul should appear inside the parent li, not as a
    // sibling at the top level.
    const liWithChild = /<li[^>]*>.*?Parent[\s\S]*?<ul[^>]*>[\s\S]*?Child[\s\S]*?<\/ul>[\s\S]*?<\/li>/;
    expect(out).toMatch(liWithChild);
  });

  it("returns to the parent level after a nested run", () => {
    const md = ["- A", "  - A1", "- B"].join("\n");
    const out = html(md);
    // Two top-level items (A, B) — count <li>s that are direct
    // children of the outermost <ul>. Tree must close A's nested
    // <ul> before opening B's <li>.
    expect(out).toMatch(/A1[\s\S]*?<\/ul>[\s\S]*?<li[^>]*>[\s\S]*?B/);
  });

  it("supports two levels of nesting", () => {
    const md = ["- Top", "  - Mid", "    - Deep"].join("\n");
    const out = html(md);
    // Three <ul>s should appear in the output (top, mid, deep).
    const ulCount = (out.match(/<ul/g) ?? []).length;
    expect(ulCount).toBe(3);
    // Deep is inside Mid is inside Top.
    expect(out).toMatch(
      /<li[\s\S]*Top[\s\S]*<ul[\s\S]*<li[\s\S]*Mid[\s\S]*<ul[\s\S]*<li[\s\S]*Deep/,
    );
  });

  it("mixes kinds across levels (bullets containing numbers)", () => {
    const md = ["- Bullet", "  1. Numbered"].join("\n");
    const out = html(md);
    // Top is <ul>, nested is <ol>.
    expect(out).toMatch(
      /<ul[\s\S]*<li[\s\S]*Bullet[\s\S]*<ol[\s\S]*<li[\s\S]*Numbered/,
    );
  });

  it("nests tasks under tasks", () => {
    const md = [
      "- [ ] Outer",
      "  - [x] Inner done",
      "  - [ ] Inner open",
    ].join("\n");
    const out = html(md);
    // The outer task's flex-column wrapper holds a nested ul.
    expect(out).toMatch(
      /Outer[\s\S]*?<ul[^>]*>[\s\S]*?Inner done[\s\S]*?Inner open[\s\S]*?<\/ul>/,
    );
  });

  it("indents nested content visually (pl-6 wrapper on task children)", () => {
    const md = ["- [ ] Outer", "  - [ ] Inner"].join("\n");
    const out = html(md);
    // Task lists wrap nested children in a pl-6 div so the inner
    // bullets indent past the checkbox. Look for the class.
    expect(out).toMatch(/class="pl-6"/);
  });

  it("treats a sibling at lower indent as ending the nested run", () => {
    const md = [
      "- A",
      "  - A1",
      "  - A2",
      "- B",
      "  - B1",
    ].join("\n");
    const out = html(md);
    // A1, A2 nest under A; B1 nests under B. A's nested <ul> must
    // close before B's <li> opens.
    expect(out).toMatch(/A2[\s\S]*?<\/ul>[\s\S]*?<li[^>]*>[\s\S]*?B[\s\S]*?<ul/);
  });

  it("treats a kind change at the same indent as a new top-level list", () => {
    const md = ["- Bullet", "1. Numbered"].join("\n");
    const out = html(md);
    // Should be a <ul> and a separate <ol> at the same level.
    expect(out).toMatch(/<ul[\s\S]*<\/ul>[\s\S]*<ol/);
  });
});

describe("toggleTaskInSource", () => {
  it("toggles `- [ ]` to `- [x]`", () => {
    const src = "- [ ] Brine the turkey";
    expect(toggleTaskInSource(src, 0)).toBe("- [x] Brine the turkey");
  });

  it("toggles `- [x]` to `- [ ]`", () => {
    const src = "- [x] Done";
    expect(toggleTaskInSource(src, 0)).toBe("- [ ] Done");
  });

  it("tolerates uppercase X (CommonMark allows either)", () => {
    const src = "- [X] Capital cross";
    expect(toggleTaskInSource(src, 0)).toBe("- [ ] Capital cross");
  });

  it("works with the `*` bullet marker", () => {
    const src = "* [ ] Star bullet";
    expect(toggleTaskInSource(src, 0)).toBe("* [x] Star bullet");
  });

  it("only mutates the targeted line", () => {
    const src = ["- [ ] One", "- [ ] Two", "- [ ] Three"].join("\n");
    const next = toggleTaskInSource(src, 1);
    expect(next).toBe(
      ["- [ ] One", "- [x] Two", "- [ ] Three"].join("\n"),
    );
  });

  it("preserves leading whitespace on indented tasks", () => {
    // Nested tasks must keep their indentation after toggling so the
    // markdown structure (and renderer's nesting) survives.
    const src = "  - [ ] Nested";
    expect(toggleTaskInSource(src, 0)).toBe("  - [x] Nested");
  });

  it("toggles a deeply-nested task without affecting siblings", () => {
    const src = [
      "- [ ] Top",
      "  - [ ] Mid",
      "    - [ ] Deep",
      "    - [ ] Deep two",
      "- [ ] Other top",
    ].join("\n");
    const next = toggleTaskInSource(src, 2);
    const lines = next.split("\n");
    expect(lines[2]).toBe("    - [x] Deep");
    expect(lines[3]).toBe("    - [ ] Deep two"); // sibling unchanged
    expect(lines[1]).toBe("  - [ ] Mid"); // parent unchanged
  });

  it("is a no-op when the targeted line isn't a task", () => {
    const src = "## Day before\n- Just a bullet";
    expect(toggleTaskInSource(src, 1)).toBe(src);
  });

  it("returns the original source for out-of-range indices", () => {
    const src = "- [ ] Only one";
    expect(toggleTaskInSource(src, 5)).toBe(src);
    expect(toggleTaskInSource(src, -1)).toBe(src);
  });

  it("survives windows-style line endings", () => {
    const src = "- [ ] One\r\n- [ ] Two";
    expect(toggleTaskInSource(src, 1)).toBe("- [ ] One\n- [x] Two");
  });
});
