import { describe, it, expect } from "vitest";
import {
  AdditionalItemSchema,
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  GroceryItemSchema,
  GroceryListSchema,
  GuestGroupSchema,
  MealPlanInputSchema,
  PrepItemSchema,
  PrepSectionSchema,
} from "../mealPlan";

describe("GuestGroupSchema", () => {
  const valid = {
    id: "g1",
    name: "McMullen Family",
    adults: 2,
    kids: 2,
  };

  it("accepts a valid family group", () => {
    expect(() => GuestGroupSchema.parse(valid)).not.toThrow();
  });

  it("accepts an empty name (mid-edit state)", () => {
    // Same back-compat pattern as PrepItem text — the row survives a
    // refresh while the user is still typing.
    expect(() =>
      GuestGroupSchema.parse({ ...valid, name: "" }),
    ).not.toThrow();
  });

  it("accepts zero adults and zero kids", () => {
    expect(() =>
      GuestGroupSchema.parse({ ...valid, adults: 0, kids: 0 }),
    ).not.toThrow();
  });

  it("rejects negative adult counts", () => {
    expect(() =>
      GuestGroupSchema.parse({ ...valid, adults: -1 }),
    ).toThrow();
  });

  it("rejects negative kid counts", () => {
    expect(() => GuestGroupSchema.parse({ ...valid, kids: -1 })).toThrow();
  });

  it("rejects fractional counts", () => {
    expect(() =>
      GuestGroupSchema.parse({ ...valid, adults: 1.5 }),
    ).toThrow();
  });

  it("rejects counts above 50", () => {
    expect(() =>
      GuestGroupSchema.parse({ ...valid, adults: 51 }),
    ).toThrow();
  });

  it("rejects name over 120 characters", () => {
    expect(() =>
      GuestGroupSchema.parse({ ...valid, name: "a".repeat(121) }),
    ).toThrow();
  });

  it("rejects empty id", () => {
    expect(() => GuestGroupSchema.parse({ ...valid, id: "" })).toThrow();
  });
});

describe("PrepItemSchema", () => {
  const valid = { id: "p1", text: "Brine the turkey", done: false };

  it("accepts valid prep item", () => {
    expect(() => PrepItemSchema.parse(valid)).not.toThrow();
  });

  it("accepts empty text (mid-edit state)", () => {
    // Empty text is legal so the row survives a refresh while the
    // user is still typing — the rendered placeholder takes over.
    expect(() =>
      PrepItemSchema.parse({ ...valid, text: "" }),
    ).not.toThrow();
  });

  it("accepts text at the 500-char limit", () => {
    expect(() =>
      PrepItemSchema.parse({ ...valid, text: "a".repeat(500) }),
    ).not.toThrow();
  });

  it("rejects text over 500 characters", () => {
    expect(() =>
      PrepItemSchema.parse({ ...valid, text: "a".repeat(501) }),
    ).toThrow();
  });

  it("rejects non-boolean done", () => {
    expect(() =>
      PrepItemSchema.parse({ ...valid, done: "yes" as unknown as boolean }),
    ).toThrow();
  });

  it("rejects empty id", () => {
    expect(() => PrepItemSchema.parse({ ...valid, id: "" })).toThrow();
  });
});

describe("PrepSectionSchema", () => {
  const validItem = { id: "p1", text: "Roast", done: false };
  const valid = { id: "s1", heading: "Day of", items: [validItem] };

  it("accepts a section with items", () => {
    expect(() => PrepSectionSchema.parse(valid)).not.toThrow();
  });

  it("accepts an empty items array", () => {
    expect(() =>
      PrepSectionSchema.parse({ ...valid, items: [] }),
    ).not.toThrow();
  });

  it("accepts an empty heading (mid-edit state)", () => {
    expect(() =>
      PrepSectionSchema.parse({ ...valid, heading: "" }),
    ).not.toThrow();
  });

  it("rejects heading over 120 characters", () => {
    expect(() =>
      PrepSectionSchema.parse({ ...valid, heading: "a".repeat(121) }),
    ).toThrow();
  });

  it("rejects when items contains a malformed entry", () => {
    expect(() =>
      PrepSectionSchema.parse({
        ...valid,
        items: [validItem, { id: "p2", text: "x" }],
      }),
    ).toThrow();
  });
});

describe("GROCERY_CATEGORIES", () => {
  it("preserves the documented order", () => {
    expect(GROCERY_CATEGORIES).toEqual([
      "fruits",
      "vegetables",
      "meats",
      "dairy",
      "cheeses",
      "baking-and-dry-goods",
      "bread-and-crackers",
      "beverages",
      "paper-goods",
      "misc",
    ]);
  });

  it("contains exactly 10 categories", () => {
    expect(GROCERY_CATEGORIES.length).toBe(10);
  });

  it("has unique values", () => {
    expect(new Set(GROCERY_CATEGORIES).size).toBe(GROCERY_CATEGORIES.length);
  });
});

describe("GROCERY_CATEGORY_LABELS", () => {
  it("provides a label for every category slug", () => {
    for (const cat of GROCERY_CATEGORIES) {
      expect(GROCERY_CATEGORY_LABELS[cat]).toBeTypeOf("string");
      expect(GROCERY_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it("matches the user-requested heading copy", () => {
    expect(GROCERY_CATEGORY_LABELS["baking-and-dry-goods"]).toBe(
      "Baking and Dry Goods",
    );
    expect(GROCERY_CATEGORY_LABELS["bread-and-crackers"]).toBe(
      "Bread and Crackers",
    );
    expect(GROCERY_CATEGORY_LABELS["paper-goods"]).toBe("Paper Goods");
    expect(GROCERY_CATEGORY_LABELS.misc).toBe("Misc");
  });

  it("has labels keyed exclusively to GROCERY_CATEGORIES", () => {
    const labelKeys = Object.keys(GROCERY_CATEGORY_LABELS).sort();
    const catKeys = [...GROCERY_CATEGORIES].sort();
    expect(labelKeys).toEqual(catKeys);
  });
});

describe("GroceryItemSchema", () => {
  const valid = { text: "Yellow onions (3 medium)", category: "vegetables" as const };

  it("accepts a valid item", () => {
    expect(() => GroceryItemSchema.parse(valid)).not.toThrow();
  });

  it("rejects empty text", () => {
    expect(() =>
      GroceryItemSchema.parse({ ...valid, text: "" }),
    ).toThrow();
  });

  it("rejects text over 280 characters", () => {
    expect(() =>
      GroceryItemSchema.parse({ ...valid, text: "a".repeat(281) }),
    ).toThrow();
  });

  it("rejects category not in the enum", () => {
    expect(() =>
      GroceryItemSchema.parse({
        ...valid,
        category: "produce" as unknown as "vegetables",
      }),
    ).toThrow();
  });

  it.each(GROCERY_CATEGORIES)(
    "accepts %s as a category",
    (cat) => {
      expect(() =>
        GroceryItemSchema.parse({ ...valid, category: cat }),
      ).not.toThrow();
    },
  );
});

describe("GroceryListSchema", () => {
  it("accepts an empty items list", () => {
    expect(() => GroceryListSchema.parse({ items: [] })).not.toThrow();
  });

  it("accepts a list with multiple items", () => {
    const parsed = GroceryListSchema.parse({
      items: [
        { text: "Onions", category: "vegetables" },
        { text: "Buttermilk (1 cup)", category: "dairy" },
      ],
    });
    expect(parsed.items).toHaveLength(2);
  });

  it("rejects when items contains a malformed entry", () => {
    expect(() =>
      GroceryListSchema.parse({
        items: [{ text: "Onions" }],
      }),
    ).toThrow();
  });
});

describe("AdditionalItemSchema", () => {
  const valid = { id: "i1", name: "Crudité" };

  it("accepts an item without broughtBy", () => {
    expect(() => AdditionalItemSchema.parse(valid)).not.toThrow();
  });

  it("accepts an item with broughtBy", () => {
    expect(() =>
      AdditionalItemSchema.parse({ ...valid, broughtBy: "Alice" }),
    ).not.toThrow();
  });

  it("accepts an empty name (mid-edit state)", () => {
    // Same back-compat with the editor pattern as PrepItem — the
    // user can add a row and start typing without the doc rejecting.
    expect(() =>
      AdditionalItemSchema.parse({ ...valid, name: "" }),
    ).not.toThrow();
  });

  it("rejects name over 200 characters", () => {
    expect(() =>
      AdditionalItemSchema.parse({ ...valid, name: "a".repeat(201) }),
    ).toThrow();
  });

  it("rejects broughtBy over 100 characters", () => {
    expect(() =>
      AdditionalItemSchema.parse({
        ...valid,
        broughtBy: "a".repeat(101),
      }),
    ).toThrow();
  });

  it("rejects empty id", () => {
    expect(() =>
      AdditionalItemSchema.parse({ ...valid, id: "" }),
    ).toThrow();
  });
});

describe("MealPlanInputSchema", () => {
  const minimal = {
    name: "Thanksgiving 2026",
    guests: [],
    recipeIds: [],
  };

  it("accepts a minimal plan", () => {
    expect(() => MealPlanInputSchema.parse(minimal)).not.toThrow();
  });

  it("rejects empty name", () => {
    expect(() =>
      MealPlanInputSchema.parse({ ...minimal, name: "" }),
    ).toThrow();
  });

  it("rejects name over 200 characters", () => {
    expect(() =>
      MealPlanInputSchema.parse({ ...minimal, name: "a".repeat(201) }),
    ).toThrow();
  });

  it("accepts plans with prepSections omitted (back-compat)", () => {
    // prepSections is optional precisely so old meal plans created
    // before the feature shipped continue to parse cleanly.
    expect(() => MealPlanInputSchema.parse(minimal)).not.toThrow();
  });

  it("accepts plans with additionalItems omitted (back-compat)", () => {
    expect(() => MealPlanInputSchema.parse(minimal)).not.toThrow();
  });

  it("accepts plans with additionalItems present", () => {
    const parsed = MealPlanInputSchema.parse({
      ...minimal,
      additionalItems: [
        { id: "i1", name: "Wine", broughtBy: "Alice" },
        { id: "i2", name: "Crudité" },
      ],
    });
    expect(parsed.additionalItems).toHaveLength(2);
  });

  it("accepts plans with prepSections present", () => {
    const parsed = MealPlanInputSchema.parse({
      ...minimal,
      prepSections: [
        {
          id: "s1",
          heading: "Day before",
          items: [{ id: "p1", text: "Brine", done: false }],
        },
      ],
    });
    expect(parsed.prepSections).toHaveLength(1);
  });

  it("rejects recipeIds containing an empty string", () => {
    expect(() =>
      MealPlanInputSchema.parse({ ...minimal, recipeIds: [""] }),
    ).toThrow();
  });

  it("accepts a populated family list", () => {
    const parsed = MealPlanInputSchema.parse({
      ...minimal,
      guests: [
        { id: "g1", name: "McMullen Family", adults: 2, kids: 2 },
        { id: "g2", name: "Singletons", adults: 4, kids: 0 },
      ],
    });
    expect(parsed.guests).toHaveLength(2);
  });

  it("accepts plans with prepNotes (the new markdown field)", () => {
    const parsed = MealPlanInputSchema.parse({
      ...minimal,
      prepNotes: "## Day before\n- [ ] Brine turkey",
    });
    expect(parsed.prepNotes).toContain("Brine turkey");
  });
});
