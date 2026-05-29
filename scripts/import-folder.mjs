#!/usr/bin/env node
/**
 * Bulk-import markdown recipes from a directory tree into Firestore.
 *
 * Walks the given root directory recursively. For every .md file, parses
 * the markdown using the same conventions as the in-app importer (see
 * web/src/lib/importMarkdown.ts — kept in sync manually) and writes it
 * to the recipes collection. The IMMEDIATE PARENT FOLDER NAME becomes
 * the chapter (category).
 *
 * URL-preferred extraction: if a markdown file contains a source URL
 * (e.g. `Source: https://…` line) AND the deployed importFromUrl
 * Cloud Function is reachable, the script first invokes that function
 * with the URL — same pipeline (and prompt, and JSON-LD pre-extraction,
 * and Claude config) the in-app URL importer uses. On any failure
 * (site blocks the fetch, function errors, network timeout) it falls
 * back to parsing the markdown directly.
 *
 * URL invocation requires a Firebase Web API key to mint an ID token
 * for the owner UID via Identity Toolkit. The script will read it
 * automatically from web/.env (VITE_FIREBASE_API_KEY) or take it from
 * the FIREBASE_API_KEY env var. Without one set, URL extraction is
 * skipped entirely and every file is parsed as markdown.
 *
 * Uses Firebase Admin SDK — bypasses security rules. You need:
 *   1. A service account JSON from Firebase Console
 *      (Project settings → Service accounts → Generate new private key)
 *   2. The owner UID — your Firebase Auth user id (Firebase Console →
 *      Authentication → Users)
 *
 * Usage:
 *   node scripts/import-folder.mjs <root-dir> <owner-uid>
 *
 * Env:
 *   FIREBASE_SERVICE_ACCOUNT     Path to service-account.json (default:
 *                                scripts/service-account.json)
 *   FIREBASE_API_KEY             Firebase Web API key (optional —
 *                                falls back to web/.env if present).
 *                                Required for URL-first extraction.
 *   FIREBASE_FUNCTIONS_REGION    Region the functions are deployed to
 *                                (default: us-central1).
 *
 * Example:
 *   node scripts/import-folder.mjs "C:/recipes" "abc123uid"
 */

import {initializeApp, cert} from "firebase-admin/app";
import {getAuth as getAdminAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [, , rootDir, ownerUid] = process.argv;
if (!rootDir || !ownerUid) {
  console.error("Usage: node scripts/import-folder.mjs <root-dir> <owner-uid>");
  process.exit(1);
}
if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
  console.error(`Not a directory: ${rootDir}`);
  process.exit(1);
}

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.join(__dirname, "service-account.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account not found: ${serviceAccountPath}`);
  console.error(
    "Download from Firebase Console → Project settings → Service accounts → Generate new private key",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
initializeApp({credential: cert(serviceAccount)});
const db = getFirestore();

// URL-first extraction calls the deployed importFromUrl Cloud Function
// over HTTPS, authed as the owner. Requires a Firebase Web API key to
// mint an ID token. Read from env, fall back to web/.env so users with
// the standard workspace layout don't have to set anything.
const webApiKey = process.env.FIREBASE_API_KEY || readWebApiKeyFromDotEnv();
const functionsRegion = process.env.FIREBASE_FUNCTIONS_REGION || "us-central1";
const projectId = serviceAccount.project_id;
const URL_IMPORT_ENABLED = Boolean(webApiKey && projectId);

if (URL_IMPORT_ENABLED) {
  console.log(
    `URL-first extraction: ENABLED (will call importFromUrl in ${functionsRegion}/${projectId})`,
  );
} else {
  console.log(
    "URL-first extraction: disabled (set FIREBASE_API_KEY env var or have web/.env with VITE_FIREBASE_API_KEY)",
  );
}

/**
 * Look for the Firebase Web API key in web/.env at the workspace root,
 * since that's where it lives during normal development.
 *
 * @return {string | null} The key, or null if .env isn't present / doesn't have it
 */
function readWebApiKeyFromDotEnv() {
  const envPath = path.join(__dirname, "..", "web", ".env");
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^\s*VITE_FIREBASE_API_KEY\s*=\s*["']?(.+?)["']?\s*$/m);
  return match ? match[1].trim() : null;
}

let imported = 0;
let skipped = 0;
// Track every chapter we write a recipe into. After the import loop we
// merge these into users/{uid}.categories so the new chapters appear in
// the sidebar nav — without this, recipes land under "Other" because
// their category doesn't match any chapter the user has defined.
const importedChapters = new Set();

for (const filePath of walkMarkdown(rootDir)) {
  const relPath = path.relative(rootDir, filePath);
  const text = fs.readFileSync(filePath, "utf8");
  const mdRecipe = parseMarkdown(text);
  if (!mdRecipe.title) {
    console.warn(`SKIP  ${relPath}  (no title detected)`);
    skipped++;
    continue;
  }

  // URL-first: if the markdown declared a source URL and we can reach
  // the deployed importFromUrl Cloud Function, call IT (single source
  // of truth for the extraction pipeline — same prompt, same JSON-LD
  // pre-extraction, same Claude config the in-app importer uses). On
  // any failure we log the reason and fall through to the markdown
  // parse — never block an import on a flaky URL.
  let recipe = mdRecipe;
  let usedSource = "markdown";
  const sourceUrl = mdRecipe.source?.type === "url" ? mdRecipe.source.url : null;
  if (sourceUrl && URL_IMPORT_ENABLED) {
    try {
      const extracted = await callImportFromUrl(sourceUrl);
      // The deployed function already pins source.url to the input
      // URL, but be defensive in case that ever changes.
      extracted.source = {type: "url", url: sourceUrl};
      recipe = extracted;
      usedSource = "url";
    } catch (err) {
      console.warn(
        `  URL extraction failed for ${sourceUrl}: ${err.message}. Falling back to markdown.`,
      );
    }
  }

  // Immediate parent folder = chapter name. Normalize: lowercase + trim.
  const chapter = path.basename(path.dirname(filePath)).toLowerCase().trim();
  if (!recipe.ingredients) recipe.ingredients = [];
  if (!recipe.instructions) recipe.instructions = [];
  // Also tag every imported recipe with its chapter name so searches /
  // filters that use tags surface chapter-mate recipes alongside any
  // user-added tags. Dedup via Set so we don't double-add if the
  // markdown's own "Tags: ..." line already listed the chapter.
  const tagSet = new Set(recipe.tags ?? []);
  if (chapter) tagSet.add(chapter);
  recipe.tags = Array.from(tagSet);

  const doc = {
    ...recipe,
    category: chapter,
    ownerId: ownerUid,
    sharedWith: [],
    searchTokens: buildSearchTokens(recipe),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  // Firestore rejects undefined values
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];

  const ref = await db.collection("recipes").add(doc);
  console.log(`OK    ${relPath} → ${chapter} via ${usedSource} (${ref.id})`);
  imported++;
  importedChapters.add(chapter);
}

// Merge any new chapters into the user's chapter list (creates the doc
// with defaults if it doesn't exist — first import on a fresh user).
// Compare case-insensitively to preserve the user's existing casing.
if (importedChapters.size > 0) {
  const userRef = db.collection("users").doc(ownerUid);
  const snap = await userRef.get();
  const existing = snap.exists ? (snap.data().categories ?? []) : [];
  const existingKeys = new Set(existing.map((c) => c.toLowerCase()));
  const additions = [...importedChapters].filter((c) => !existingKeys.has(c));
  if (additions.length > 0) {
    const updated = [...existing, ...additions];
    await userRef.set(
      {
        ownerId: ownerUid,
        categories: updated,
        updatedAt: FieldValue.serverTimestamp(),
        // createdAt only applied on first write — merge:true won't overwrite
        // an existing value, but seeds it for brand-new user docs.
        createdAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    console.log(
      `\nAdded ${additions.length} new chapter(s) to user list: ${additions.join(", ")}`,
    );
  } else {
    console.log("\nAll imported chapters already in user list — no changes.");
  }
}

console.log(`\nDone. Imported ${imported}, skipped ${skipped}.`);
process.exit(0);

// ---------------------------------------------------------------------------
// Helpers — duplicated from web/src/lib/importMarkdown.ts and
// shared/src/searchTokens.ts. Kept inline so this script has no workspace
// dependencies and can run standalone.
// ---------------------------------------------------------------------------

function* walkMarkdown(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMarkdown(full);
    else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) yield full;
  }
}

function parseMarkdown(text) {
  const result = {};
  const lines = text.split(/\r?\n/);

  const titleIdx = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (titleIdx >= 0) {
    result.title = lines[titleIdx].replace(/^#\s+/, "").trim();
    lines[titleIdx] = "";
  }

  for (let i = 0; i < lines.length; i++) {
    const url = matchSourceUrl(lines[i]);
    if (url) {
      result.source = {type: "url", url};
      lines[i] = "";
      break;
    }
  }

  let ingredientsHeader = -1;
  let instructionsHeader = -1;
  let notesHeader = -1;

  for (let i = 0; i < lines.length; i++) {
    const head = headerText(lines[i]);
    if (head === null) continue;
    if (
      ingredientsHeader < 0 &&
      /^(ingredients?|what you('?ll)? need)$/.test(head)
    ) {
      ingredientsHeader = i;
    } else if (
      instructionsHeader < 0 &&
      /^(directions?|instructions?|steps?|method|preparation|to (make|prepare))$/.test(
        head,
      )
    ) {
      instructionsHeader = i;
    } else if (notesHeader < 0 && /^(notes?|tips?)$/.test(head)) {
      notesHeader = i;
    }
  }

  // Fallback: many recipes name the instructions section after the
  // cooking method ("**Roast:**", "**Grill:**", "**Assembly:**") instead
  // of using the literal word "Instructions". If Ingredients is present
  // but no Instructions header was matched, treat the first subsequent
  // EXPLICIT header (hash or bold-text — not just any short line) that
  // isn't Notes/Tips as the instructions header.
  if (ingredientsHeader >= 0 && instructionsHeader < 0) {
    for (let i = ingredientsHeader + 1; i < lines.length; i++) {
      if (!isExplicitHeader(lines[i])) continue;
      const head = headerText(lines[i]);
      if (head === null) continue;
      if (/^(notes?|tips?)$/.test(head)) continue;
      instructionsHeader = i;
      break;
    }
  }

  const headStart = titleIdx >= 0 ? titleIdx + 1 : 0;
  const headEnd = Math.min(
    ingredientsHeader >= 0 ? ingredientsHeader : Infinity,
    instructionsHeader >= 0 ? instructionsHeader : Infinity,
    notesHeader >= 0 ? notesHeader : Infinity,
    lines.length,
  );
  for (let i = headStart; i < headEnd; i++) {
    const m = lines[i].match(/^([A-Za-z][A-Za-z '-]+):\s*(.+?)\s*$/);
    if (m && applyMetadata(result, m[1].trim().toLowerCase(), m[2].trim())) {
      lines[i] = "";
    }
  }

  // Shape fallback: when there are no section headers anywhere,
  // recognize the canonical "bulleted ingredient list followed by
  // prose instructions" layout common in hand-written / OneNote
  // recipes. Without this, every header-less recipe ends up with
  // everything dumped into ingredients.
  if (
    ingredientsHeader < 0 &&
    instructionsHeader < 0 &&
    notesHeader < 0
  ) {
    let firstBullet = -1;
    let lastBulletInRun = -1;
    for (let i = headStart; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const isBullet = /^([•\-*–—·]|\(?\d+[.)])\s+/.test(line);
      if (isBullet) {
        if (firstBullet < 0) firstBullet = i;
        lastBulletInRun = i;
      } else if (firstBullet >= 0) {
        break;
      }
    }
    if (firstBullet >= 0) {
      let hasProseAfter = false;
      for (let i = lastBulletInRun + 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          hasProseAfter = true;
          break;
        }
      }
      if (hasProseAfter) {
        const ing = parseItemsWithSubsections(
          lines.slice(firstBullet, lastBulletInRun + 1),
        );
        const inst = parseItemsWithSubsections(
          lines.slice(lastBulletInRun + 1),
        );
        if (ing.length > 0) result.ingredients = ing;
        if (inst.length > 0) result.instructions = inst;
        return result;
      }
    }
  }

  const ingStart = ingredientsHeader >= 0 ? ingredientsHeader + 1 : headStart;
  const ingEnd =
    instructionsHeader >= 0
      ? instructionsHeader
      : notesHeader >= 0
        ? notesHeader
        : lines.length;
  if (ingStart < ingEnd) {
    const parsed = parseItemsWithSubsections(lines.slice(ingStart, ingEnd));
    if (parsed.length > 0) result.ingredients = parsed;
  }
  if (instructionsHeader >= 0) {
    const instEnd = notesHeader >= 0 ? notesHeader : lines.length;
    const parsed = parseItemsWithSubsections(
      lines.slice(instructionsHeader + 1, instEnd),
    );
    if (parsed.length > 0) result.instructions = parsed;
  }
  if (notesHeader >= 0) {
    const notesText = lines
      .slice(notesHeader + 1)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (notesText) result.notes = notesText;
  }
  return result;
}

function headerText(line) {
  const raw = line.trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.+?)\*\*$/, "$1")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
  if (cleaned.length === 0 || cleaned.length > 60) return null;
  if (cleaned.split(/\s+/).length > 6) return null;
  return cleaned;
}

/**
 * True only when a line carries explicit heading markup — leading
 * "#"/"##"/"###" or "**bold-wrapped**". Used to gate the
 * instructions-header fallback so ingredient/step text never gets
 * mistaken for a section header.
 *
 * @param {string} line  Raw markdown line
 * @return {boolean}
 */
function isExplicitHeader(line) {
  const raw = line.trim();
  if (!raw) return false;
  if (/^#{1,6}\s+\S/.test(raw)) return true;
  if (/^\*\*.+?:?\*\*$/.test(raw)) return true;
  return false;
}

function matchSourceUrl(line) {
  const trimmed = line.trim();
  const m = trimmed.match(
    /^(?:from|source|url)\s*:?\s*<?(https?:\/\/[^\s>]+)>?\s*$/i,
  );
  return m ? m[1] : null;
}

function applyMetadata(out, key, value) {
  switch (key) {
    case "source":
    case "url":
    case "from": {
      if (/^https?:\/\//i.test(value)) {
        out.source = {type: "url", url: value};
      } else {
        const m = value.match(
          /^(.+?)(?:\s+by\s+(.+?))?(?:,\s*p\.?\s*(.+))?$/i,
        );
        if (m && m[1].trim()) {
          const source = {type: "book", title: m[1].trim()};
          if (m[2]) source.author = m[2].trim();
          if (m[3]) source.page = m[3].trim();
          out.source = source;
        }
      }
      return true;
    }
    case "yield":
    case "servings":
    case "serves":
      out.yield = value;
      return true;
    case "prep":
    case "prep time":
      out.prepTime = value;
      return true;
    case "cook":
    case "cook time":
      out.cookTime = value;
      return true;
    case "total":
    case "total time":
      out.totalTime = value;
      return true;
    case "tags": {
      const tags = value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tags.length > 0) out.tags = tags;
      return true;
    }
    case "category": {
      const c = value.trim().toLowerCase();
      if (c) out.category = c;
      return true;
    }
    case "photo":
    case "photourl":
    case "image": {
      if (/^https?:\/\//i.test(value)) out.photoUrl = value;
      return true;
    }
    case "rating": {
      const n = Number.parseInt(value, 10);
      if (n >= 1 && n <= 5) out.rating = n;
      return true;
    }
    case "lastmade":
    case "last made":
    case "last made date": {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) out.lastMadeDate = value;
      return true;
    }
    default:
      return false;
  }
}

function parseItemsWithSubsections(lines) {
  const classified = lines
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const stripped = stripListMarker(raw);
      return {hadMarker: stripped !== raw, text: stripped};
    });
  if (classified.length === 0) return [];

  const anyMarkers = classified.some((c) => c.hadMarker);

  const sections = [];
  let current = null;

  for (const line of classified) {
    // Recognize both "# Foo" / "## Foo" / "### Foo" hash headings AND
    // "**Foo**" / "**Foo:**" bold-text headings (OneNote and many
    // hand-written recipes use the bold form rather than hashes).
    const hashHeading = line.text.match(/^#{1,3}\s+(.+?):?$/);
    const boldHeading = line.text.match(/^\*\*(.+?):?\*\*$/);
    const explicit = hashHeading || boldHeading;

    const isHeuristicHeading =
      anyMarkers &&
      !line.hadMarker &&
      !explicit &&
      line.text.length <= 60 &&
      line.text.split(/\s+/).length <= 8;

    if (explicit || isHeuristicHeading) {
      if (current && current.items.length > 0) sections.push(current);
      const heading = explicit
        ? explicit[1].trim()
        : line.text.replace(/:$/, "").trim();
      current = {heading, items: []};
    } else {
      if (!current) current = {heading: null, items: []};
      current.items.push(line.text);
    }
  }
  if (current && current.items.length > 0) sections.push(current);
  return sections;
}

function stripListMarker(line) {
  return line
    .trim()
    .replace(/^[•\-*–—·]\s+/, "")
    .trim()
    .replace(/^\(?\d+[.)]\s+/, "")
    .trim();
}

function buildSearchTokens(input) {
  const tokens = new Set();
  for (const word of tokenize(input.title ?? "")) tokens.add(word);
  for (const section of input.ingredients ?? []) {
    if (section.heading) for (const w of tokenize(section.heading)) tokens.add(w);
    for (const item of section.items) {
      for (const w of tokenize(item)) tokens.add(w);
    }
  }
  return Array.from(tokens);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

// ---------------------------------------------------------------------------
// URL-first extraction: call the deployed importFromUrl Cloud Function.
// Single source of truth lives in functions/src/importFromUrl.ts — this
// script just authenticates as the owner and invokes the same callable
// endpoint the in-app importer uses.
// ---------------------------------------------------------------------------

// Firebase ID tokens are valid for 1 hour. Cache the exchanged token and
// reuse it across calls within that window to avoid one custom-token /
// REST-exchange round-trip per recipe (matters when importing 100+ files).
let cachedIdToken = null;
let cachedIdTokenExpiresAt = 0;

/**
 * Mint a Firebase ID token for the importing user by:
 *   1. Creating a custom token via Admin SDK (signed with the service
 *      account, no user interaction needed)
 *   2. Exchanging it for an ID token via Identity Toolkit REST
 *      (needs the project's Web API key — same value as the web SDK
 *      config)
 *
 * @return {Promise<string>} Bearer token to send to the callable function
 */
async function getOwnerIdToken() {
  if (cachedIdToken && Date.now() < cachedIdTokenExpiresAt) {
    return cachedIdToken;
  }
  const customToken = await getAdminAuth().createCustomToken(ownerUid);
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({token: customToken, returnSecureToken: true}),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`token exchange failed (HTTP ${resp.status}): ${text}`);
  }
  const data = await resp.json();
  cachedIdToken = data.idToken;
  // Refresh 10 min before expiry to dodge clock skew.
  cachedIdTokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return cachedIdToken;
}

/**
 * Invoke the deployed importFromUrl callable function with the given
 * URL, returning the structured recipe the same way the in-app
 * importer does. Throws on any failure so the caller can fall back
 * to markdown parsing.
 *
 * @param {string} url Recipe URL to extract
 * @return {Promise<object>} Structured recipe matching RecipeInput shape
 */
async function callImportFromUrl(url) {
  const idToken = await getOwnerIdToken();
  const fnUrl =
    `https://${functionsRegion}-${projectId}.cloudfunctions.net/importFromUrl`;
  const resp = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    // Callable functions wrap the input as {data: <args>} on the wire.
    body: JSON.stringify({data: {url}}),
    // The function itself has a 60s timeout; give the round-trip a
    // little extra headroom for network + cold-start.
    signal: AbortSignal.timeout(75_000),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`function returned HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  // Callable response: success → {result: <returned-value>}, error →
  // {error: {code, message, details?}}. Surface either cleanly.
  if (json.error) {
    throw new Error(`${json.error.code ?? "error"}: ${json.error.message ?? "unknown"}`);
  }
  if (!json.result || !json.result.recipe) {
    throw new Error("function returned no recipe in response");
  }
  return json.result.recipe;
}

