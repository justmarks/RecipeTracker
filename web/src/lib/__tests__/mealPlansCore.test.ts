import { describe, it, expect } from "vitest";
import {
  newClientId,
  parseGuestField,
  parseMealPlanDoc,
  prepSectionsToMarkdown,
} from "../mealPlansCore";

describe("parseMealPlanDoc", () => {
  const minimal = {
    ownerId: "user1",
    name: "Sunday dinner",
  };

  it("hydrates a minimal stored doc", () => {
    const plan = parseMealPlanDoc("plan1", minimal);
    expect(plan.id).toBe("plan1");
    expect(plan.ownerId).toBe("user1");
    expect(plan.name).toBe("Sunday dinner");
  });

  it("defaults missing guests to an empty array", () => {
    const plan = parseMealPlanDoc("p", minimal);
    expect(plan.guests).toEqual([]);
  });

  it("defaults missing recipeIds to an empty array", () => {
    const plan = parseMealPlanDoc("p", minimal);
    expect(plan.recipeIds).toEqual([]);
  });

  it("defaults missing prep notes to an empty string (back-compat)", () => {
    // Plans created before the prep markdown shipped have neither
    // prepNotes nor prepSections; the parser must not crash on them.
    const plan = parseMealPlanDoc("p", minimal);
    expect(plan.prepNotes).toBe("");
  });

  it("converts legacy prepSections into prepNotes markdown", () => {
    // Plans with the older structured prep list get their content
    // promoted to markdown so the new editor surfaces it.
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      prepSections: [
        {
          id: "s1",
          heading: "Day before",
          items: [
            { id: "p1", text: "Brine", done: false },
            { id: "p2", text: "Make crust", done: true },
          ],
        },
      ],
    });
    expect(plan.prepNotes).toBe(
      "## Day before\n- [ ] Brine\n- [x] Make crust",
    );
  });

  it("prefers prepNotes when both fields are present", () => {
    // Once we've written prepNotes, the prepSections field becomes
    // stale — the parser should ignore it in favor of the new field.
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      prepNotes: "## Real notes\n- [ ] new task",
      prepSections: [
        {
          id: "s1",
          heading: "Stale",
          items: [{ id: "p1", text: "old", done: false }],
        },
      ],
    });
    expect(plan.prepNotes).toContain("new task");
    expect(plan.prepNotes).not.toContain("Stale");
  });

  it("defaults missing additionalItems to an empty array (back-compat)", () => {
    // Same back-compat consideration as prepSections — plans created
    // before non-recipe additions shipped just don't carry the field.
    const plan = parseMealPlanDoc("p", minimal);
    expect(plan.additionalItems).toEqual([]);
  });

  it("coerces a malformed additionalItems field to empty (defensive)", () => {
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      additionalItems: "not an array" as unknown as never,
    });
    expect(plan.additionalItems).toEqual([]);
  });

  it("hydrates additionalItems when present", () => {
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      additionalItems: [
        { id: "i1", name: "Wine", broughtBy: "Alice" },
        { id: "i2", name: "Crudité" },
      ],
    });
    expect(plan.additionalItems).toHaveLength(2);
    expect(plan.additionalItems[0].broughtBy).toBe("Alice");
    expect(plan.additionalItems[1].broughtBy).toBeUndefined();
  });

  it("leaves groceryList undefined when the doc has no cache", () => {
    const plan = parseMealPlanDoc("p", minimal);
    expect(plan.groceryList).toBeUndefined();
    expect(plan.groceryListGeneratedAt).toBeUndefined();
  });

  it("hydrates a full doc", () => {
    const plan = parseMealPlanDoc("p", {
      ownerId: "u",
      name: "Thanksgiving",
      notes: "Bring extra wine",
      guests: [
        { id: "g1", name: "McMullen Family", adults: 2, kids: 2 },
      ],
      recipeIds: ["r1", "r2"],
      prepNotes: "## Day before\n- [ ] Brine",
      groceryList: {
        items: [{ text: "Onions", category: "vegetables" }],
      },
    });
    expect(plan.notes).toBe("Bring extra wine");
    expect(plan.guests).toHaveLength(1);
    expect(plan.guests[0].name).toBe("McMullen Family");
    expect(plan.recipeIds).toEqual(["r1", "r2"]);
    expect(plan.prepNotes).toContain("Brine");
    expect(plan.groceryList?.items).toHaveLength(1);
  });

  it("coerces a malformed guests field to empty (defensive)", () => {
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      guests: "not an array" as unknown as never,
    });
    expect(plan.guests).toEqual([]);
  });

  it("coerces a malformed recipeIds field to empty (defensive)", () => {
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      recipeIds: { 0: "r1" } as unknown as never,
    });
    expect(plan.recipeIds).toEqual([]);
  });

  it("drops a groceryList without an items array", () => {
    const plan = parseMealPlanDoc("p", {
      ...minimal,
      groceryList: { generatedAt: "yesterday" } as unknown as never,
    });
    expect(plan.groceryList).toBeUndefined();
  });

  it("treats an empty notes string as no notes", () => {
    const plan = parseMealPlanDoc("p", { ...minimal, notes: "" });
    expect(plan.notes).toBeUndefined();
  });

  it("preserves notes that contain only whitespace", () => {
    // notes is a free-form field; whitespace is content the user
    // typed. The trim happens in the write path, not the read path.
    const plan = parseMealPlanDoc("p", { ...minimal, notes: "   " });
    expect(plan.notes).toBe("   ");
  });

  it("defaults missing ownerId to empty string", () => {
    // Defensive default — security rules block reads without an
    // owner check, so this only matters for malformed test fixtures
    // and corrupted docs.
    const plan = parseMealPlanDoc("p", { name: "X" });
    expect(plan.ownerId).toBe("");
  });

  it("defaults missing name to empty string", () => {
    const plan = parseMealPlanDoc("p", { ownerId: "u" });
    expect(plan.name).toBe("");
  });

  it("passes through createdAt / updatedAt / groceryListGeneratedAt", () => {
    // Timestamps are opaque at this layer — consumer reattaches the
    // Firestore Timestamp type. We just need to round-trip whatever
    // value the snapshot had.
    const ts = { sentinel: true };
    const plan = parseMealPlanDoc("p", {
      ownerId: "u",
      name: "X",
      createdAt: ts,
      updatedAt: ts,
      groceryListGeneratedAt: ts,
    });
    expect(plan.createdAt).toBe(ts);
    expect(plan.updatedAt).toBe(ts);
    expect(plan.groceryListGeneratedAt).toBe(ts);
  });
});

describe("newClientId", () => {
  it("returns a non-empty string", () => {
    expect(newClientId()).toMatch(/.+/);
  });

  it("returns a unique value across calls", () => {
    const a = newClientId();
    const b = newClientId();
    expect(a).not.toBe(b);
  });

  it("produces stable-shape ids across 100 calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(newClientId());
    expect(ids.size).toBe(100);
  });
});

describe("parseGuestField (back-compat)", () => {
  it("returns an empty list for non-array input", () => {
    expect(parseGuestField(undefined)).toEqual([]);
    expect(parseGuestField(null)).toEqual([]);
    expect(parseGuestField("oops")).toEqual([]);
    expect(parseGuestField({})).toEqual([]);
  });

  it("returns an empty list for an empty array", () => {
    expect(parseGuestField([])).toEqual([]);
  });

  it("passes new-shape entries through (sanitized)", () => {
    const groups = parseGuestField([
      { id: "g1", name: "McMullen", adults: 2, kids: 2 },
    ]);
    expect(groups).toEqual([
      { id: "g1", name: "McMullen", adults: 2, kids: 2 },
    ]);
  });

  it("collapses legacy per-person entries into a single Guests group", () => {
    // Old shape: each entry has {id, name, type: "adult"|"child"} with
    // no `adults` count. parseGuestField recognizes that shape and
    // bins everyone into one fallback group with the right totals so
    // the cook still sees their headcount.
    const groups = parseGuestField([
      { id: "g1", name: "Alice", type: "adult" },
      { id: "g2", name: "Bob", type: "adult" },
      { id: "g3", name: "Cody", type: "child" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Guests");
    expect(groups[0].adults).toBe(2);
    expect(groups[0].kids).toBe(1);
  });

  it("returns empty when legacy entries have no recognized types", () => {
    const groups = parseGuestField([
      { id: "g1", name: "?", type: "unknown" },
    ]);
    expect(groups).toEqual([]);
  });

  it("ignores malformed new-shape entries (defensive)", () => {
    const groups = parseGuestField([
      { id: "g1", name: "Good", adults: 2, kids: 1 },
      "junk",
      null,
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Good");
  });

  it("defaults missing fields on new-shape entries", () => {
    const groups = parseGuestField([
      { id: "g1", adults: 3 },
      { id: "g2", name: "Singletons" },
    ]);
    expect(groups[0]).toEqual({
      id: "g1",
      name: "",
      adults: 3,
      kids: 0,
    });
    expect(groups[1]).toEqual({
      id: "g2",
      name: "Singletons",
      adults: 0,
      kids: 0,
    });
  });
});

describe("prepSectionsToMarkdown (back-compat)", () => {
  it("returns empty string for non-array input", () => {
    expect(prepSectionsToMarkdown(undefined)).toBe("");
    expect(prepSectionsToMarkdown(null)).toBe("");
    expect(prepSectionsToMarkdown({})).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(prepSectionsToMarkdown([])).toBe("");
  });

  it("converts a section into `## Heading` + task lines", () => {
    const md = prepSectionsToMarkdown([
      {
        id: "s1",
        heading: "Day before",
        items: [
          { id: "p1", text: "Brine the turkey", done: false },
          { id: "p2", text: "Make pie crust", done: true },
        ],
      },
    ]);
    expect(md).toBe(
      "## Day before\n- [ ] Brine the turkey\n- [x] Make pie crust",
    );
  });

  it("inserts a blank line between consecutive headings", () => {
    const md = prepSectionsToMarkdown([
      {
        id: "s1",
        heading: "Day before",
        items: [{ id: "p1", text: "Brine", done: false }],
      },
      {
        id: "s2",
        heading: "Day of",
        items: [{ id: "p2", text: "Roast", done: false }],
      },
    ]);
    expect(md).toBe(
      "## Day before\n- [ ] Brine\n\n## Day of\n- [ ] Roast",
    );
  });

  it("skips empty headings and empty item text", () => {
    const md = prepSectionsToMarkdown([
      {
        id: "s1",
        heading: "  ",
        items: [{ id: "p1", text: "   ", done: false }],
      },
      {
        id: "s2",
        heading: "Real",
        items: [{ id: "p2", text: "Task", done: false }],
      },
    ]);
    expect(md).toBe("## Real\n- [ ] Task");
  });

  it("skips non-object section entries", () => {
    const md = prepSectionsToMarkdown([
      null,
      "rogue",
      {
        id: "s1",
        heading: "Sane",
        items: [{ id: "p1", text: "Item", done: false }],
      },
    ]);
    expect(md).toBe("## Sane\n- [ ] Item");
  });
});
