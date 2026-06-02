import type { TagTone } from "../components/ui";

/**
 * Pure helpers used by the tags library. Lives in its own file so unit
 * tests can import without pulling in the firebase client SDK — the
 * larger tags.ts module wraps these in Firestore writes.
 */

/**
 * Normalize a tag for storage. Tags are stored lowercase + collapsed
 * whitespace so "Vegetarian " and "vegetarian" reconcile. Display can
 * apply capitalize via CSS, but storage stays lowercase to match the
 * RecipeForm submit + tagToneFor lookup convention.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Description of how a tagColors map should change. `set` enumerates
 * key → new tone; `del` lists keys that need a Firestore
 * `deleteField()` sentinel applied. The split exists because setDoc
 * with `merge: true` deep-merges nested maps and silently preserves
 * keys the new payload doesn't mention. Tests can verify the diff
 * shape without needing the firebase SDK in scope.
 *
 * Generic over the value type so callers can pass either the
 * validated `Record<string, TagTone>` from the palette hook or the
 * loose `Record<string, string>` read straight off a Firestore
 * snapshot — the diff math is the same either way.
 */
export interface TagColorsDiff<T extends string = string> {
  set: Record<string, T>;
  del: string[];
}

/**
 * Compute the diff between two palette snapshots. Keys present in
 * `next` are written verbatim; keys that existed in `previous` but
 * disappeared from `next` are returned in `del` so the caller can
 * splice in deleteField() sentinels.
 *
 * Identical inputs return empty `set` (no writes) and empty `del`
 * (nothing to remove) — the caller can skip the write entirely on
 * a no-op.
 */
export function buildTagColorsDiff<T extends string>(
  previous: Record<string, T>,
  next: Record<string, T>,
): TagColorsDiff<T> {
  const diff: TagColorsDiff<T> = { set: {}, del: [] };
  for (const [k, v] of Object.entries(next)) {
    // Only emit the key when it's new or its value changed — this lets
    // callers keep "do nothing if identical" semantics. Firestore would
    // accept an identical write but it'd burn a write op.
    if (previous[k] !== v) diff.set[k] = v;
  }
  for (const k of Object.keys(previous)) {
    if (!(k in next)) diff.del.push(k);
  }
  return diff;
}

/**
 * Validated tag tones — keeps the runtime allow-list aligned with
 * the TagTone union. Exported so the palette type-guard in tags.ts
 * and the swatch popover both use the same source of truth.
 */
export const TAG_TONE_VALUES: readonly TagTone[] = [
  "default",
  "tomato",
  "olive",
  "saffron",
  "plum",
  "sage",
  "berry",
  "cocoa",
  "sky",
  "slate",
] as const;

export function isTagTone(value: unknown): value is TagTone {
  return (
    typeof value === "string" && (TAG_TONE_VALUES as readonly string[]).includes(value)
  );
}
