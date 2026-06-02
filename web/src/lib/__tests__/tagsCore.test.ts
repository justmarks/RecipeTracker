import { describe, it, expect } from "vitest";
import {
  buildTagColorsDiff,
  isTagTone,
  normalizeTag,
  TAG_TONE_VALUES,
} from "../tagsCore";

describe("normalizeTag", () => {
  it("lowercases input", () => {
    expect(normalizeTag("Vegetarian")).toBe("vegetarian");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeTag("  weeknight  ")).toBe("weeknight");
  });

  it("collapses internal whitespace runs into a single space", () => {
    expect(normalizeTag("gluten   free")).toBe("gluten free");
  });

  it("collapses tabs and newlines", () => {
    expect(normalizeTag("kid\t\tfriendly\nmeal")).toBe("kid friendly meal");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeTag("   ")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeTag("")).toBe("");
  });

  it("preserves hyphens and apostrophes inside the tag", () => {
    expect(normalizeTag("Mom's Recipe")).toBe("mom's recipe");
    expect(normalizeTag("Gluten-Free")).toBe("gluten-free");
  });
});

describe("buildTagColorsDiff", () => {
  it("returns empty set + del for identical maps", () => {
    const palette = { kid: "olive" as const, spicy: "tomato" as const };
    const diff = buildTagColorsDiff(palette, palette);
    expect(diff.set).toEqual({});
    expect(diff.del).toEqual([]);
  });

  it("emits set entries for added keys", () => {
    const diff = buildTagColorsDiff({}, { kid: "olive" });
    expect(diff.set).toEqual({ kid: "olive" });
    expect(diff.del).toEqual([]);
  });

  it("emits del entries for removed keys", () => {
    // This is THE bug the helper guards against — setDoc(merge: true)
    // silently preserves keys we don't mention, so deletions have to
    // be explicit.
    const diff = buildTagColorsDiff({ kid: "olive" }, {});
    expect(diff.set).toEqual({});
    expect(diff.del).toEqual(["kid"]);
  });

  it("emits set for value-only changes", () => {
    const diff = buildTagColorsDiff({ kid: "olive" }, { kid: "berry" });
    expect(diff.set).toEqual({ kid: "berry" });
    expect(diff.del).toEqual([]);
  });

  it("ignores keys whose value is unchanged", () => {
    const diff = buildTagColorsDiff(
      { kid: "olive", spicy: "tomato" },
      { kid: "olive", spicy: "berry" },
    );
    expect(diff.set).toEqual({ spicy: "berry" });
    expect(diff.del).toEqual([]);
  });

  it("handles a simultaneous add + remove (merge case)", () => {
    const diff = buildTagColorsDiff(
      { kid: "olive" },
      { weeknight: "saffron" },
    );
    expect(diff.set).toEqual({ weeknight: "saffron" });
    expect(diff.del).toEqual(["kid"]);
  });

  it("handles the merge-tag rename case", () => {
    // Tag merge: source key disappears, target key gets the source's
    // color (the consumer applied this before calling buildTagColorsDiff).
    const diff = buildTagColorsDiff(
      { spicy: "tomato" },
      { hot: "tomato" },
    );
    expect(diff.set).toEqual({ hot: "tomato" });
    expect(diff.del).toEqual(["spicy"]);
  });

  it("does not mutate the input maps", () => {
    const prev = { kid: "olive" as const };
    const next = { kid: "berry" as const };
    const before = { prev: { ...prev }, next: { ...next } };
    buildTagColorsDiff(prev, next);
    expect(prev).toEqual(before.prev);
    expect(next).toEqual(before.next);
  });
});

describe("TAG_TONE_VALUES", () => {
  it("includes the brand five plus the expansion five", () => {
    expect(TAG_TONE_VALUES).toEqual([
      "default",
      "tomato",
      "olive",
      "saffron",
      "plum",
      "sage",
      "berry",
      "cocoa",
      "sky",
      "slate",
    ]);
  });

  it("is exactly 10 entries", () => {
    expect(TAG_TONE_VALUES.length).toBe(10);
  });

  it("has unique values", () => {
    expect(new Set(TAG_TONE_VALUES).size).toBe(TAG_TONE_VALUES.length);
  });
});

describe("isTagTone", () => {
  it.each(TAG_TONE_VALUES)("accepts %s", (tone) => {
    expect(isTagTone(tone)).toBe(true);
  });

  it("rejects unknown tone strings", () => {
    expect(isTagTone("crimson")).toBe(false);
    expect(isTagTone("brand")).toBe(false);
    expect(isTagTone("veg")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isTagTone(undefined)).toBe(false);
    expect(isTagTone(null)).toBe(false);
    expect(isTagTone(42)).toBe(false);
    expect(isTagTone({})).toBe(false);
  });
});
