import {onCall, HttpsError} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// Stable system prompt — kept fixed so prompt caching applies. Only the
// per-request URL + HTML in the user message varies.
const SYSTEM_PROMPT = `You are a recipe extraction assistant.

Given the HTML content of a webpage that contains a recipe, extract the recipe's structured data using the extract_recipe tool. Always use the tool — do not return free-form text.

Extract every field that appears in the HTML. None of these are "nice to have" — pull them whenever the page has them.

Field guide:
- title (required) — the recipe's name
- ingredients with section headings (e.g. "Cake", "Frosting"). Use a single section with heading: null if the recipe has only one group.
- instructions with section headings, same rules as ingredients
- yield — servings or yield (e.g. "4 servings", "12 cookies", "1 loaf")
- prepTime — active preparation time (e.g. "20 min")
- cookTime — passive cook/bake/rest time (e.g. "40 min")
- totalTime — total elapsed time start to finish (e.g. "1 hr")
- notes — tips, variations, or supplementary commentary
- category — short lowercase chapter name. Prefer the closest of: appetizer, side, sauce, soup, salad, entree, dessert. One or two words.
- tags — lowercase kebab-case attributes like "gluten-free", "vegetarian", "dairy-free" — only if clearly indicated.
- photoUrl — absolute https URL to the main recipe photo. Check <meta property="og:image">, <meta name="twitter:image">, and the schema.org/Recipe "image" field (which may be a string, an array, or an object with "url"). Omit if none are present.

All extracted text must be PLAIN TEXT, not JSON-encoded. If you copy a string from a <script type="application/ld+json"> block, decode JSON escape sequences yourself: write real newlines instead of \\n, real quotes instead of \\", real ampersands instead of &amp;. The downstream renderer treats the values as plaintext — escape sequences will display literally.

Time fields are critical and frequently missed. Most modern recipe sites embed prepTime/cookTime/totalTime/recipeYield in a <script type="application/ld+json"> schema.org/Recipe block — search for that block first. Convert ISO 8601 durations:
  PT20M    → "20 min"
  PT1H     → "1 hr"
  PT1H30M  → "1 hr 30 min"
  PT2H15M  → "2 hr 15 min"

Strip leading bullets ("•", "-", "*") and numbered markers ("1.", "1)") from ingredient and instruction items — return clean text.

The server overrides source after extraction, so do not worry about emitting source — it will be set to {type: "url", url: <the URL>} automatically.

If the HTML does not contain a recipe, return a single section in ingredients with heading null and one item describing what was found. Use the page title as the recipe title.`;

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

    // Hard cap on HTML size — Claude Haiku 4.5 has a 200K context window;
    // ~150KB of HTML is a safe ceiling that leaves headroom for the system
    // prompt + response. Truncate from the end (footers/scripts are usually
    // less useful than the head where the recipe sits).
    const HTML_LIMIT = 150_000;
    if (html.length > HTML_LIMIT) {
      html = html.slice(0, HTML_LIMIT);
    }

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
            "Return the structured recipe extracted from the provided URL and HTML.",
          input_schema: RECIPE_TOOL_SCHEMA as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: {type: "tool", name: "extract_recipe"},
      messages: [
        {
          role: "user",
          content: `URL: ${url}\n\nHTML:\n${html}`,
        },
      ],
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
 * Recursively unescape JSON-style escape sequences in every string value.
 * Uses a placeholder swap so literal backslashes survive intact while
 * \n / \r / \t / \" / \' become their actual characters. Defensive against
 * AI extractions that copy verbatim from JSON-LD payloads.
 *
 * @param {unknown} value Recipe shape from the AI (object | array | string)
 * @return {unknown} Same shape with strings unescaped in place
 */
function deepUnescape(value: unknown): unknown {
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
