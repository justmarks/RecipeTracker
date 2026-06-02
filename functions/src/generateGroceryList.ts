import {onCall, HttpsError} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";

if (getApps().length === 0) initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

/**
 * Category slugs the client-side schema also exports as
 * GROCERY_CATEGORIES. Inlined here (rather than imported from shared/)
 * to keep the function build self-contained — matches the pattern in
 * importFromUrl.ts where the tool schema is local to the file.
 */
export const GROCERY_CATEGORIES = [
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
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

// Stable instructions — held fixed so prompt caching applies. Only the
// per-request recipe text in the user message varies, so on warm hits
// we pay the cached-input rate for the system prompt.
const SYSTEM_PROMPT = `You are a grocery list builder for a home recipe app.

You receive a meal plan: a list of recipes with their ingredient lines. Produce a single consolidated shopping list using the submit_grocery_list tool. Always use the tool — never reply with free-form text.

CONSOLIDATION RULES:
1. Merge the SAME ingredient across recipes into one shopping line. "1 onion" in recipe A + "1 cup chopped onions" in recipe B → ONE entry like "Yellow onions (2 medium, plus 1 cup chopped)".
2. Sum quantities when units match cleanly. Two recipes calling for "1 cup all-purpose flour" each → "All-purpose flour (2 cups)". When units don't match cleanly, append each occurrence rather than guess conversions.
3. Use plain, shopper-friendly product names. "1 cup buttermilk, room temperature, plus more for brushing" → "Buttermilk (about 1 cup)". Strip preparation directions ("chopped", "minced", "drained") unless they describe a different SKU at the store (e.g. "ground beef" vs "beef chuck" stay distinct).
4. SKIP "to taste" pantry items: salt, black pepper, water. (Other spices and condiments still go on the list.)
5. SKIP section headings ("## For the sauce", "## Cake") — those are not ingredients.
6. SKIP plain garnishes called out as optional ("optional: fresh herbs for garnish") unless a specific quantity is given.

CATEGORIZATION — assign each item to exactly ONE category:
- fruits — fresh fruits and berries; dried fruit goes to baking-and-dry-goods
- vegetables — fresh vegetables, fresh herbs, garlic, ginger, mushrooms, alliums
- meats — beef, pork, chicken, lamb, fish, shellfish, eggs, deli meats, tofu (the protein shelf)
- dairy — milk, butter, cream, yogurt, sour cream, buttermilk, ice cream
- cheeses — all cheeses (parm, mozzarella, cream cheese, ricotta, feta, …)
- baking-and-dry-goods — flour, sugar, leaveners, spices, oils, vinegars, condiments, sauces, canned goods, pasta, rice, beans, dried fruit, nuts, chocolate, broth, stock
- bread-and-crackers — sandwich bread, baguettes, rolls, tortillas, pita, crackers, breadcrumbs, panko
- beverages — juice, soda, wine, beer, spirits, coffee, tea, sparkling water
- paper-goods — napkins, paper towels, parchment, foil, plastic wrap, baking cups
- misc — anything that genuinely doesn't fit (ice, candles, gift items)

OUTPUT RULES:
- Order items inside each category any way that reads naturally — produce shelf order works (e.g. greens together, then alliums, then root veg) but isn't required.
- Each item.text is one shopping line. Keep it under 120 characters.
- Categories with no items: omit them entirely. Don't emit empty groups.`;

const GROCERY_TOOL_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            minLength: 1,
            maxLength: 280,
            description:
              "Shopping line: shopper-friendly product name plus combined quantity. Example: 'Yellow onions (3 medium, plus 1 cup chopped)'.",
          },
          category: {
            type: "string",
            enum: [...GROCERY_CATEGORIES],
            description:
              "Exactly one of the ten allowed categories.",
          },
        },
        required: ["text", "category"],
      },
    },
  },
  required: ["items"],
} as const;

export interface RecipeForPrompt {
  title: string;
  ingredientsBlock: string;
}

/**
 * Render a recipe's ingredients section list as a single markdown
 * block — `## Heading` lines for each subsection, then bullet items
 * underneath. Matches the format the model already handles well from
 * the import flow.
 *
 * Exported so unit tests can verify the malformed-input fallbacks
 * (non-array ingredients, sections without headings, items that
 * aren't strings) without spinning up the full callable.
 */
export function recipeToPromptBlock(
  title: string,
  ingredients: unknown,
): RecipeForPrompt | null {
  if (!Array.isArray(ingredients)) return null;
  const lines: string[] = [];
  for (const section of ingredients) {
    if (!section || typeof section !== "object") continue;
    const heading = (section as {heading?: unknown}).heading;
    const items = (section as {items?: unknown}).items;
    if (typeof heading === "string" && heading.trim()) {
      lines.push(`## ${heading.trim()}`);
    }
    if (Array.isArray(items)) {
      for (const it of items) {
        if (typeof it === "string" && it.trim()) lines.push(`- ${it.trim()}`);
      }
    }
  }
  if (lines.length === 0) return null;
  return {title, ingredientsBlock: lines.join("\n")};
}

/**
 * generateGroceryList — consume the recipes referenced by a meal plan
 * and produce a categorized, consolidated shopping list. Caches the
 * result back onto the meal plan doc (`groceryList`, `groceryListGeneratedAt`)
 * so subsequent loads don't pay for a re-generation. The client decides
 * when to regenerate (after the plan changes) by calling this again.
 */
export const generateGroceryList = onCall<{planId?: string}>(
  {
    secrets: [anthropicApiKey],
    timeoutSeconds: 90,
    memory: "512MiB",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in to build a grocery list.",
      );
    }
    const planId = request.data?.planId?.trim();
    if (!planId) {
      throw new HttpsError("invalid-argument", "planId is required.");
    }

    const db = getFirestore();
    const planRef = db.collection("mealPlans").doc(planId);
    const planSnap = await planRef.get();
    if (!planSnap.exists) {
      throw new HttpsError("not-found", "Meal plan not found.");
    }
    const plan = planSnap.data() as {
      ownerId?: string;
      name?: string;
      recipeIds?: unknown;
    };
    if (plan.ownerId !== uid) {
      // Only the plan's owner can build (or read) the grocery list,
      // mirroring the mealPlans/{id} security rules.
      throw new HttpsError(
        "permission-denied",
        "You can only build grocery lists for your own meal plans.",
      );
    }

    const recipeIds = Array.isArray(plan.recipeIds) ?
      (plan.recipeIds as string[]).filter((s) => typeof s === "string" && s) :
      [];
    if (recipeIds.length === 0) {
      const empty = {items: []};
      await planRef.update({
        groceryList: empty,
        groceryListGeneratedAt: FieldValue.serverTimestamp(),
      });
      return empty;
    }

    // Load every referenced recipe with the admin SDK (which bypasses
    // security rules) but enforce the same access predicate that
    // firestore.rules uses for recipe reads: owner OR explicit share
    // OR auto-share grant. Skip anything the user isn't entitled to so
    // a leaked recipe id in the plan doesn't leak ingredients.
    const recipeSnaps = await Promise.all(
      recipeIds.map((id) => db.collection("recipes").doc(id).get()),
    );
    const accessibleRecipes: RecipeForPrompt[] = [];
    for (const snap of recipeSnaps) {
      if (!snap.exists) continue;
      const r = snap.data() as {
        ownerId?: string;
        title?: string;
        ingredients?: unknown;
        sharedWith?: unknown;
      };
      const ownerId = r.ownerId;
      if (typeof ownerId !== "string") continue;

      const sharedWith = Array.isArray(r.sharedWith) ? r.sharedWith : [];
      const isOwner = ownerId === uid;
      const isExplicitShare = sharedWith.includes(uid);
      let hasAutoShare = false;
      if (!isOwner && !isExplicitShare) {
        const autoSnap = await db
          .collection("autoShares")
          .doc(`${ownerId}_${uid}`)
          .get();
        hasAutoShare = autoSnap.exists;
      }
      if (!isOwner && !isExplicitShare && !hasAutoShare) continue;

      const block = recipeToPromptBlock(
        typeof r.title === "string" && r.title ? r.title : "Untitled recipe",
        r.ingredients,
      );
      if (block) accessibleRecipes.push(block);
    }

    if (accessibleRecipes.length === 0) {
      const empty = {items: []};
      await planRef.update({
        groceryList: empty,
        groceryListGeneratedAt: FieldValue.serverTimestamp(),
      });
      return empty;
    }

    // Compose the user message: meal plan name + each recipe block.
    // Order doesn't matter for consolidation; the model uses titles
    // only for context (e.g. "buttermilk biscuits" vs "buttermilk
    // marinade" both ask for buttermilk).
    const userMessage = [
      `Meal plan: ${plan.name ?? "Untitled meal plan"}`,
      `Recipes (${accessibleRecipes.length}):`,
      "",
      ...accessibleRecipes.map(
        (r) => `### ${r.title}\n${r.ingredientsBlock}`,
      ),
    ].join("\n\n");

    const client = new Anthropic({apiKey: anthropicApiKey.value()});
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // ephemeral cache so the stable system prompt is reused
          // across calls. Per the Claude API skill: caching the
          // instructions block is the cheap, high-ROI move.
          cache_control: {type: "ephemeral"},
        },
      ],
      tools: [
        {
          name: "submit_grocery_list",
          description:
            "Submit the consolidated grocery list as a flat array of " +
            "categorized items.",
          input_schema:
            GROCERY_TOOL_SCHEMA as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: {type: "tool", name: "submit_grocery_list"},
      messages: [{role: "user", content: userMessage}],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new HttpsError(
        "internal",
        "Claude did not return a structured grocery list. Try again.",
      );
    }

    const raw = toolUse.input as {items?: unknown};
    const items: {text: string; category: GroceryCategory}[] = [];
    if (Array.isArray(raw.items)) {
      const validCategories = new Set<string>(GROCERY_CATEGORIES);
      for (const entry of raw.items) {
        if (!entry || typeof entry !== "object") continue;
        const text = (entry as {text?: unknown}).text;
        const cat = (entry as {category?: unknown}).category;
        if (typeof text !== "string" || !text.trim()) continue;
        const trimmed = text.trim().slice(0, 280);
        const category = typeof cat === "string" && validCategories.has(cat) ?
          (cat as GroceryCategory) :
          "misc";
        items.push({text: trimmed, category});
      }
    }

    const result = {items};

    await planRef.update({
      groceryList: result,
      groceryListGeneratedAt: FieldValue.serverTimestamp(),
    });

    return result;
  },
);
