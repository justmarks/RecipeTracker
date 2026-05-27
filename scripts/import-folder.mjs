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
 *   FIREBASE_SERVICE_ACCOUNT  Path to service-account.json (default:
 *                             scripts/service-account.json)
 *
 * Example:
 *   node scripts/import-folder.mjs "C:/recipes" "abc123uid"
 */

import {initializeApp, cert} from "firebase-admin/app";
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

let imported = 0;
let skipped = 0;
for (const filePath of walkMarkdown(rootDir)) {
  const relPath = path.relative(rootDir, filePath);
  const text = fs.readFileSync(filePath, "utf8");
  const recipe = parseMarkdown(text);
  if (!recipe.title) {
    console.warn(`SKIP  ${relPath}  (no title detected)`);
    skipped++;
    continue;
  }
  // Immediate parent folder = chapter name. Normalize: lowercase + trim.
  const chapter = path.basename(path.dirname(filePath)).toLowerCase().trim();
  if (!recipe.ingredients) recipe.ingredients = [];
  if (!recipe.instructions) recipe.instructions = [];
  if (!recipe.tags) recipe.tags = [];

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
  console.log(`OK    ${relPath} → ${chapter} (${ref.id})`);
  imported++;
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
    const explicit = line.text.match(/^#{1,3}\s+(.+?):?$/);
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
