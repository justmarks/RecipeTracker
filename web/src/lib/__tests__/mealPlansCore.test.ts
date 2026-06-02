import { describe, it, expect } from "vitest";
import {
  GUEST_TYPES,
  newClientId,
  parseMealPlanDoc,
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

  it("defaults missing prepSections to an empty array (back-compat)", () => {
    // Plans created before the prep list feature shipped have no
    // prepSections field. The parser must not crash on them.
    const plan = parseMealPlanDoc("p", minimal);
    expect(plan.prepSections).toEqual([]);
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
      guests: [{ id: "g1", name: "Alice", type: "adult" }],
      recipeIds: ["r1", "r2"],
      prepSections: [
        {
          id: "s1",
          heading: "Day before",
          items: [{ id: "p1", text: "Brine", done: false }],
        },
      ],
      groceryList: {
        items: [{ text: "Onions", category: "vegetables" }],
      },
    });
    expect(plan.notes).toBe("Bring extra wine");
    expect(plan.guests).toHaveLength(1);
    expect(plan.recipeIds).toEqual(["r1", "r2"]);
    expect(plan.prepSections).toHaveLength(1);
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

describe("GUEST_TYPES", () => {
  it("contains exactly adult and child", () => {
    expect([...GUEST_TYPES]).toEqual(["adult", "child"]);
  });
});
