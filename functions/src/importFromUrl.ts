import {onCall, HttpsError} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import {waitForInstrumentation} from "./instrumentation";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// Stable system prompt — kept fixed so prompt caching applies. Only the
// per-request URL + content in the user message varies.
const SYSTEM_PROMPT = `You are a recipe extraction assistant.

You will receive either (a) the schema.org/Recipe JSON-LD block extracted from a webpage, or (b) the raw HTML when JSON-LD isn't available. Either way, return the structured data using the extract_recipe tool. Always use the tool — never return free-form text.

CRITICAL ANTI-FABRICATION RULES — read these twice:

1. NEVER invent ingredients or steps that aren't literally present in the input. If a chimichurri recipe doesn't mention basil, don't add basil because chimichurri "usually" has herbs. If you can't find the recipe in the input, your output should say so (see point 5).
2. Preserve multi-section recipes. If a page lists multiple sub-recipes ("Cake" + "Frosting", "Marinade" + "Sauce" + "Steak", "Green Chimichurri" + "Smokey Red Chimichurri"), return them as DISTINCT sections with their headings — one per section. Do NOT collapse them into a single flat list, and do NOT pick just one section.
3. Match quantities exactly. "1 1/2 pounds skirt steak" is not "2 pounds skirt steak." Copy numbers verbatim.
4. If a field isn't present, omit it. Leaving notes empty is better than inventing notes.
5. If the input has no recipe at all (paywall page, error page, anti-bot challenge, unrelated content), set title to "Recipe content not found" and put ONE ingredients section with heading: null and a single item describing what the input actually contained (e.g. "The page returned a paywall block and no recipe data was extractable"). Don't guess from the URL or title.

Field guide:
- title (required) — the recipe's name as printed
- ingredients with section headings (e.g. "Cake", "Frosting", "Green Chimichurri"). Use heading: null only when the recipe truly has only one ingredient group.
- instructions with section headings — same rules. Many recipes have instruction sections that mirror the ingredient sections; preserve that structure.
- yield — servings or yield exactly as written ("4 servings", "12 cookies", "1 loaf")
- prepTime, cookTime, totalTime — convert ISO 8601 durations (PT20M → "20 min", PT1H → "1 hr", PT1H30M → "1 hr 30 min", PT2H15M → "2 hr 15 min")
- notes — author headnote, tips, or variations. Pull the paragraph that introduces the recipe into notes.
- category — short lowercase chapter name. Prefer the closest of: appetizer, side, sauce, soup, salad, entree, dessert. One or two words.
- tags — lowercase kebab-case attributes like "gluten-free", "vegetarian", "dairy-free" — only if clearly indicated.
- photoUrl — absolute https URL to the main recipe photo. Check the JSON-LD "image" field (string, array, or {url} object), then <meta property="og:image">, then <meta name="twitter:image">. Omit if none are present.

All extracted text must be PLAIN TEXT, not JSON-encoded. If a string contains \\n, \\", or &amp; from the JSON-LD source, decode those to real characters — the renderer treats values as plaintext.

Strip leading bullets ("•", "-", "*") and numbered markers ("1.", "1)") from ingredient and instruction items — return clean text.

The server overrides source after extraction, so do not emit source — it will be set to {type: "url", url: <the URL>} automatically.`;

const RECIPE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    title: {type: "string", minLength: 1, maxLength: 500},
    source: {
      oneOf: [
        {
          type: "object",
          properties: {
            type: {const: "url"},
            url: {type: "string"},
          },
          required: ["type", "url"],
        },
        {
          type: "object",
          properties: {
            type: {const: "book"},
            title: {type: "string", minLength: 1},
            author: {type: "string"},
            page: {type: "string"},
          },
          required: ["type", "title"],
        },
      ],
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {type: ["string", "null"]},
          items: {type: "array", items: {type: "string"}},
        },
        required: ["heading", "items"],
      },
    },
    instructions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {type: ["string", "null"]},
          items: {type: "array", items: {type: "string"}},
        },
        required: ["heading", "items"],
      },
    },
    notes: {type: "string"},
    yield: {type: "string"},
    prepTime: {type: "string"},
    cookTime: {type: "string"},
    totalTime: {type: "string"},
    category: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "A short lowercase chapter name like 'entree', 'dessert', 'side'. Prefer the closest of: appetizer, side, sauce, soup, salad, entree, dessert. Use one or two words only.",
    },
    tags: {type: "array", items: {type: "string"}},
    photoUrl: {
      type: "string",
      description: "URL to the main recipe photo. Extract from <meta property=\"og:image\">, <meta name=\"twitter:image\">, or the schema.org/Recipe `image` field. Use an absolute https URL.",
    },
  },
  required: ["title", "ingredients", "instructions", "category", "tags"],
} as const;

export const importFromUrl = onCall(
  {
    secrets: [anthropicApiKey],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to import recipes.");
    }

    const data = request.data as {url?: string};
    const url = data.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new HttpsError("invalid-argument", "A valid http(s) URL is required.");
    }

    // Fetch the URL server-side. We send a full browser-like header set
    // (Client Hints included) because many recipe sites — Kitchn, NYT
    // Cooking, Cloudflare-protected sites, and Dotdash Meredith
    // properties (AllRecipes, Serious Eats, Simply Recipes, Food & Wine,
    // Eating Well, Brides) — fingerprint requests beyond the User-Agent.
    let html: string;
    try {
      const fetchResponse = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          // Client Hints — Chrome 148+ ships these by default and some
          // anti-bot systems flag their absence as a non-browser signal.
          "sec-ch-ua":
            "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "DNT": "1",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!fetchResponse.ok) {
        // 401/403: classic Forbidden/Unauthorized
        // 402: Dotdash Meredith / AllRecipes-style paywall response
        // 429: rate-limited
        // 451: legal block
        // 503: Cloudflare under attack / temporary block
        const blockedStatuses = new Set([401, 402, 403, 429, 451, 503]);
        const msg = blockedStatuses.has(fetchResponse.status) ?
          `The site blocked the request (HTTP ${fetchResponse.status}). Some recipe sites (AllRecipes, Serious Eats, NYT Cooking, etc.) refuse server-side fetches even with browser-like headers. Copy the recipe text from the page and paste it into the markdown importer below.` :
          `Failed to fetch URL (HTTP ${fetchResponse.status}).`;
        throw new HttpsError("failed-precondition", msg);
      }
      html = await fetchResponse.text();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        "internal",
        `Could not fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Pre-extract schema.org/Recipe JSON-LD blocks server-side. Most
    // recipe sites (NYT, Food Network, Bon Appetit, Serious Eats, …)
    // embed the canonical recipe as JSON-LD in the <head>. Pulling that
    // out and handing JUST the recipe blob to Claude eliminates 99% of
    // hallucination — the model has no room to invent ingredients
    // because there's no extraneous page text to confuse it with.
    //
    // Falls back to truncated HTML if no JSON-LD Recipe block is found
    // (rare — most cooking sites have it for SEO/Google Rich Results).
    const recipeJsonLd = extractRecipeJsonLd(html);

    // Hard cap on HTML size for the fallback path — Claude Haiku 4.5
    // has a 200K context window; ~180KB of HTML leaves headroom for
    // the system prompt + response. Truncate from the end (footers /
    // tracking scripts are less useful than the head where the recipe
    // metadata typically lives).
    const HTML_LIMIT = 180_000;
    if (html.length > HTML_LIMIT) {
      html = html.slice(0, HTML_LIMIT);
    }

    const userMessage = recipeJsonLd ?
      `URL: ${url}\n\nThis is the schema.org/Recipe JSON-LD block extracted from the page. ` +
        "It's the authoritative source for the recipe — extract from it directly. " +
        "If the recipe has multiple sections (e.g. recipeIngredient items grouped under recipeInstructions sections, or @graph entries for multiple sub-recipes), preserve every section.\n\n" +
        `JSON-LD:\n${recipeJsonLd}` :
      `URL: ${url}\n\nNo schema.org/Recipe JSON-LD block was found in this page. ` +
        "Extract the recipe from the raw HTML below if it's there; if it's not, follow the anti-fabrication rule and say so.\n\n" +
        `HTML:\n${html}`;

    await waitForInstrumentation();
    const client = new Anthropic({apiKey: anthropicApiKey.value()});

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: {type: "ephemeral"},
        },
      ],
      tools: [
        {
          name: "extract_recipe",
          description:
            "Return the structured recipe extracted from the provided source.",
          input_schema: RECIPE_TOOL_SCHEMA as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: {type: "tool", name: "extract_recipe"},
      messages: [{role: "user", content: userMessage}],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new HttpsError(
        "internal",
        "Claude did not return a structured recipe. Try pasting the recipe as markdown instead."
      );
    }

    // Unescape JSON-encoded escape sequences (\n, \", \\, etc.) that
    // sometimes survive the AI's extraction when it copies verbatim from
    // a <script type="application/ld+json"> block. Without this pass,
    // notes can render as literal "\n" backslash-n in the UI.
    const recipe = deepUnescape(toolUse.input) as Record<string, unknown>;

    // Override source.url with the URL the caller actually submitted —
    // we know the right value, no need to trust the model.
    recipe.source = {type: "url", url};

    return {recipe};
  }
);

/**
 * Pull every schema.org/Recipe JSON-LD blob out of an HTML page and
 * return them as a single JSON string for handoff to Claude.
 *
 * Most modern recipe sites embed the canonical recipe as
 *   <script type="application/ld+json">{ "@type": "Recipe", … }</script>
 * for SEO / Google Rich Results. Some wrap it in an @graph array along
 * with Article / BreadcrumbList / WebPage entries. We accept both and
 * filter to just the Recipe nodes.
 *
 * Returning null means "no JSON-LD Recipe was found — fall back to raw
 * HTML." This is rare for established cooking sites but possible for
 * personal blogs or markup-light pages.
 *
 * @param {string} html  Raw HTML of the recipe page
 * @return {string | null} JSON string of one or more Recipe nodes, or null
 */
export function extractRecipeJsonLd(html: string): string | null {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      collectRecipeNodes(parsed, blocks);
    } catch {
      // JSON-LD with comments or trailing commas — skip it rather than
      // crash. The HTML-fallback path will pick up the slack.
    }
  }
  if (blocks.length === 0) return null;
  return JSON.stringify(blocks.length === 1 ? blocks[0] : blocks, null, 2);
}

/**
 * Walk a parsed JSON-LD value and push any Recipe-typed node onto out.
 * Handles three shapes seen in the wild:
 *   1. A bare Recipe object: { "@type": "Recipe", ... }
 *   2. An @graph wrapper: { "@graph": [ { "@type": "Recipe", ... }, ... ] }
 *   3. An array at the top level: [ { "@type": "Recipe", ... }, ... ]
 *
 * A node's type field can be a string or an array of strings
 * (e.g. ["Recipe", "Product"]) — we accept either.
 *
 * @param {unknown} value  Parsed JSON-LD value (object | array | scalar)
 * @param {unknown[]} out  Mutable array to push Recipe nodes into
 */
export function collectRecipeNodes(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRecipeNodes(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  if ("@graph" in obj) {
    collectRecipeNodes(obj["@graph"], out);
  }
  const type = obj["@type"];
  const isRecipe =
    type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
  if (isRecipe) out.push(obj);
}

/**
 * Recursively unescape JSON-style escape sequences in every string value.
 * Uses a placeholder swap so literal backslashes survive intact while
 * \n / \r / \t / \" / \' become their actual characters. Defensive against
 * AI extractions that copy verbatim from JSON-LD payloads.
 *
 * @param {unknown} value Recipe shape from the AI (object | array | string)
 * @return {unknown} Same shape with strings unescaped in place
 */
export function deepUnescape(value: unknown): unknown {
  if (typeof value === "string") {
    // Two-char placeholder unlikely to appear in real text; replaceAll
    // with a literal string sidesteps the no-control-regex lint rule.
    const PH = "";
    return value
      .replaceAll("\\\\", PH)
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "")
      .replaceAll("\\t", "\t")
      .replaceAll("\\\"", "\"")
      .replaceAll("\\'", "'")
      .replaceAll(PH, "\\");
  }
  if (Array.isArray(value)) return value.map(deepUnescape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        deepUnescape(v),
      ]),
    );
  }
  return value;
}
