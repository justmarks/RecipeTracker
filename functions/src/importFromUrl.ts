import {onCall, HttpsError} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// Stable system prompt — kept fixed so prompt caching applies. Only the
// per-request URL + HTML in the user message varies.
const SYSTEM_PROMPT = `You are a recipe extraction assistant.

Given the HTML content of a webpage that contains a recipe, extract the recipe's structured data using the extract_recipe tool. Always use the tool — do not return free-form text.

Guidelines:
- Extract title, ingredients, instructions, and any metadata (yield, prep/cook/total time, notes).
- For ingredients and instructions, identify section headings (e.g. "Cake", "Frosting", "Avocado Goddess Sauce") and group items beneath them. If the recipe has only one section, use a single section with heading set to null.
- Choose the closest category from: appetizer, side, sauce, soup, salad, entree.
- Identify relevant tags only if clearly indicated by the recipe content. Use lowercase kebab-case (e.g. "gluten-free", "vegetarian", "dairy-free").
- Strip leading bullets ("•", "-", "*") and numbered markers ("1.", "1)") from individual ingredient and instruction items — the items should be clean text without list-marker characters.
- Set source to {type: "url", url: <the URL provided>}.
- If the HTML does not contain a recipe (e.g. it's a landing page or article without ingredients/instructions), return a single section in ingredients with heading null and one item explaining what was found, and the same for instructions. Use the page title as the recipe title.`;

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
      enum: ["appetizer", "side", "sauce", "soup", "salad", "entree"],
    },
    tags: {type: "array", items: {type: "string"}},
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

    // Fetch the URL — server-side avoids CORS issues and keeps the user-agent
    // consistent. Node 24 has native fetch.
    let html: string;
    try {
      const fetchResponse = await fetch(url, {
        headers: {
          "User-Agent": "RecipeTracker/1.0 (Claude-assisted recipe import)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!fetchResponse.ok) {
        throw new HttpsError(
          "failed-precondition",
          `Failed to fetch URL (HTTP ${fetchResponse.status}).`
        );
      }
      html = await fetchResponse.text();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        "internal",
        `Could not fetch URL: ${err instanceof Error ? err.message : String(err)}`
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

    return {recipe: toolUse.input as Record<string, unknown>};
  }
);
