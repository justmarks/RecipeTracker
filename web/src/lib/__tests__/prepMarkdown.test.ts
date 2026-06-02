import { describe, it, expect } from "vitest";
import { toggleTaskInSource } from "../prepMarkdown";

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
    // Toggled value is the canonical space; we don't preserve case.
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
    const src = "  - [ ] Nested";
    expect(toggleTaskInSource(src, 0)).toBe("  - [x] Nested");
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
    // Split-on-/\r?\n/ + rejoin-on-\n converts CRLF → LF; that's
    // intentional so the canonical source the user sees is consistent.
    expect(toggleTaskInSource(src, 1)).toBe("- [ ] One\n- [x] Two");
  });
});
