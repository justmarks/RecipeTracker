import {onCall, HttpsError} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import {waitForInstrumentation} from "./instrumentation";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// Stable system prompt — fixed so prompt caching applies. Only the
// per-request image bytes vary, which means the cache hit rate on the
// system prompt is effectively 100% across users.
const SYSTEM_PROMPT = `You are a recipe extraction assistant. You receive a single document of a recipe — typically an image (photograph of a cookbook page, magazine clipping, handwritten note card, screenshot, printout) or a PDF (scanned page, recipe export, web-page print). Use the extract_recipe tool to return structured data. Always use the tool — do not return free-form text.

Read what's actually in the source, even if the handwriting is messy, the photo is at an angle, or the lighting is uneven. For multi-page PDFs, read every page and merge content — ingredient lists often continue, instruction steps span columns, and notes / headnotes can sit on a separate page. Use context to infer obvious things (a "Cake" heading above a list followed by a "Frosting" heading above another list means two ingredient sections).

Field guide:
- title (required) — the recipe's name as printed or written. If the source has no title (e.g. it's just a list of ingredients), name it after the dish the ingredients describe.
- ingredients with section headings (e.g. "Cake", "Frosting"). Use a single section with heading: null if the recipe has only one group.
- instructions with section headings, same rules as ingredients. If steps are unnumbered, infer the order from layout (top to bottom, paragraph order).
- yield — servings or yield as written ("Serves 4", "12 cookies", "1 loaf")
- prepTime — active preparation time
- cookTime — passive cook/bake/rest time
- totalTime — total elapsed time start to finish
- notes — author's tips, variations, headnote text, or marginalia. Pull headnotes (paragraph above the ingredients describing the dish) into notes.
- category — short lowercase chapter name. Prefer the closest of: appetizer, side, sauce, soup, salad, entree, dessert. One or two words.
- tags — lowercase kebab-case attributes like "gluten-free", "vegetarian", "dairy-free" — only if clearly indicated in the source (e.g. a "Vegetarian" label, a leaf icon, an explicit note).
- source — if the source clearly shows a book title / author / page number (cookbook page, magazine masthead), emit source as {type: "book", title, author, page}. Omit otherwise — the server will not override source for photo / PDF imports, unlike the URL importer.
- photoUrl — leave empty. The image or PDF the user just shared IS the recipe content; we'll attach a hero photo separately on the client.

All extracted text must be PLAIN TEXT. Decode any markdown / typography artifacts ("—" stays as "—", but smart quotes can be normalized to straight if it improves readability).

Strip leading bullets ("•", "-", "*") and numbered markers ("1.", "1)") from ingredient and instruction items — return clean text.

If the source clearly does NOT contain a recipe (a sunset photo, a meme, a screenshot of a tweet, a PDF of a tax form), return title: "Not a recipe" with a single ingredients section heading: null containing one item describing what the source actually shows. The client will surface this so the user knows the OCR ran but found nothing usable.`;

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
  },
  required: ["title", "ingredients", "instructions", "category", "tags"],
} as const;

// Hard caps. Claude's vision input accepts up to ~5 MiB per image and
// Cloud Functions onCall payloads max at 10 MiB. We cap the base64 string
// at 7 MiB (~5.25 MiB binary, leaves headroom for the rest of the
// payload + auth). The client is responsible for resizing larger photos
// before upload — this is a safety net.
const MAX_BASE64_BYTES = 7 * 1024 * 1024;
// PDFs ride the same callable as images — a recipe scan can land as a
// JPEG snapshot or as a one-page PDF clipping equally easily, and the
// Cloud Function dispatches each to the right Claude content block
// type (image vs document) based on mime. Kept in one importer rather
// than spinning up a separate function so the system prompt, schema,
// and error handling stay consolidated.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export const importFromImage = onCall(
  {
    secrets: [anthropicApiKey],
    timeoutSeconds: 60,
    // Vision requests do more work than text — give the function more
    // headroom so the v8 process doesn't get killed mid-response.
    memory: "1GiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to import recipes.");
    }

    const data = request.data as {
      imageBase64?: string;
      mimeType?: string;
    };
    const imageBase64 = data.imageBase64;
    const mimeType = data.mimeType?.toLowerCase().trim();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "An image is required (base64 string).",
      );
    }
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpsError(
        "invalid-argument",
        `Unsupported file type. Use one of: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}.`,
      );
    }
    if (imageBase64.length > MAX_BASE64_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        `File is too large (${(imageBase64.length / 1024 / 1024).toFixed(1)} MB after base64 encoding). Resize the image or use a smaller PDF — under 5 MB.`,
      );
    }

    await waitForInstrumentation();
    const client = new Anthropic({apiKey: anthropicApiKey.value()});

    // PDFs use Claude's `document` content block (multi-page native);
    // images use the `image` block. Same base64 payload either way —
    // just a different envelope. Done as one branch so the client can
    // upload whichever it has without picking a code path.
    const isPdf = mimeType === "application/pdf";
    const mediaBlock: Anthropic.ContentBlockParam = isPdf ?
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: imageBase64,
        },
      } :
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: imageBase64,
        },
      };

    let message;
    try {
      message = await client.messages.create({
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
              "Return the structured recipe extracted from the provided image or PDF.",
            input_schema: RECIPE_TOOL_SCHEMA as unknown as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: {type: "tool", name: "extract_recipe"},
        messages: [
          {
            role: "user",
            content: [
              mediaBlock,
              {
                type: "text",
                text: isPdf ?
                  "Extract the recipe from this PDF using the extract_recipe tool. The PDF may have multiple pages — return ALL recipe content found, preserving any sub-sections." :
                  "Extract the recipe from this image using the extract_recipe tool.",
              },
            ],
          },
        ],
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new HttpsError(
          "internal",
          `Claude rejected the request: ${err.message}`,
        );
      }
      throw new HttpsError(
        "internal",
        `Vision extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new HttpsError(
        "internal",
        "Claude did not return a structured recipe. Try a clearer photo, or paste the recipe as markdown.",
      );
    }

    const recipe = toolUse.input as Record<string, unknown>;
    return {recipe};
  },
);
