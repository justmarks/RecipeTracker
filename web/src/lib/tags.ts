import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { FieldValue, WriteBatch } from "firebase/firestore";
import { db } from "./firebase";
import { useRecipeList } from "./queryRecipes";
import { TAG_TONES } from "../components/ui";
import type { TagTone } from "../components/ui";

// Build a Set once for the type-guard below. Source of truth lives in
// Tag.tsx so the validator always tracks the palette additions.
const VALID_TONES = new Set<string>(TAG_TONES);

const FIRESTORE_BATCH_LIMIT = 500;

function userDocRef(uid: string) {
  return doc(db, "users", uid);
}

/**
 * Build a `tagColors` write payload that ACTUALLY deletes removed keys.
 *
 * setDoc(ref, { tagColors: nextPalette }, { merge: true }) does a
 * recursive deep merge on the nested map — keys we just dropped from
 * `nextPalette` survive in the stored doc because the write never
 * mentions them. Firestore's `deleteField()` sentinel is the only way
 * to remove a key from a nested map via a merging write, so we splice
 * it in for every key that was in `previous` but is gone from `next`.
 */
function buildTagColorsWrite(
  previous: Record<string, string>,
  next: Record<string, string>,
): Record<string, string | FieldValue> {
  const out: Record<string, string | FieldValue> = { ...next };
  for (const k of Object.keys(previous)) {
    if (!(k in next)) out[k] = deleteField();
  }
  return out;
}

function writePalette(
  batchOrNull: WriteBatch | null,
  uid: string,
  previous: Record<string, string>,
  next: Record<string, string>,
): Promise<void> | void {
  const payload = {
    ownerId: uid,
    tagColors: buildTagColorsWrite(previous, next),
    updatedAt: serverTimestamp(),
  };
  if (batchOrNull) {
    batchOrNull.set(userDocRef(uid), payload, { merge: true });
    return;
  }
  return setDoc(userDocRef(uid), payload, { merge: true });
}

/**
 * Normalize a tag for storage. Tags are stored lowercase + collapsed
 * whitespace so "Vegetarian " and "vegetarian" reconcile. Display can
 * apply capitalize via CSS, but storage stays lowercase to match the
 * existing convention (see RecipeForm submit, tagToneFor lookup).
 */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export type TagPalette = Record<string, TagTone>;

/**
 * Live palette of explicit tag-color overrides for the signed-in user.
 * Empty palette is a valid state — every tag will fall through to the
 * heuristic in tagToneFor. The hook returns the raw map so callers can
 * pass it straight to tagToneFor(tag, palette).
 */
export function useTagPalette(uid: string | undefined): {
  palette: TagPalette;
  loading: boolean;
} {
  const [palette, setPalette] = useState<TagPalette>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPalette({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      userDocRef(uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const raw = (data.tagColors ?? {}) as Record<string, string>;
          // Strip anything that isn't a valid TagTone in case stale data
          // exists from an earlier shape — we'd rather render "default"
          // than crash on a typo.
          const cleaned: TagPalette = {};
          for (const [k, v] of Object.entries(raw)) {
            if (VALID_TONES.has(v)) cleaned[k] = v as TagTone;
          }
          setPalette(cleaned);
        } else {
          setPalette({});
        }
        setLoading(false);
      },
      (err) => {
        console.error("Tag palette snapshot:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  return { palette, loading };
}

export type TagSummary = {
  /** Lowercase tag name as stored. */
  name: string;
  /** Color tone resolved against the user's palette + heuristic. */
  tone: TagTone;
  /** Recipes (owned + shared + auto-shared) that carry this tag. */
  count: number;
  /** True when an explicit color override exists in the palette. */
  hasColor: boolean;
};

/**
 * Derived list of tags for the management page. Union of palette keys
 * (so a freshly-added-but-unused tag still appears) and tags actually
 * present on the user's visible recipes. Sorted alphabetically.
 */
export function useTags(uid: string | undefined): {
  tags: TagSummary[];
  palette: TagPalette;
  loading: boolean;
} {
  const { palette, loading: paletteLoading } = useTagPalette(uid);
  const { recipes, loading: recipesLoading } = useRecipeList(uid);

  const tags = useMemo<TagSummary[]>(() => {
    const counts = new Map<string, number>();
    // Scope to OWNED recipes — shared / auto-shared recipes belong to
    // someone else, and a merge/delete/rename can't touch them (security
    // rules block writes), so it would be misleading to show their
    // tags as something the user can manage here.
    for (const r of recipes) {
      if (r.access !== "owned") continue;
      for (const raw of r.tags ?? []) {
        const t = normalizeTag(raw);
        if (!t) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    // Add palette-only entries (added in the management UI, not yet on
    // a recipe) with count 0 so they're discoverable + editable.
    for (const k of Object.keys(palette)) {
      if (!counts.has(k)) counts.set(k, 0);
    }
    const out: TagSummary[] = [];
    for (const [name, count] of counts) {
      const tone: TagTone = palette[name] ?? "default";
      out.push({ name, tone, count, hasColor: palette[name] !== undefined });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [recipes, palette]);

  return {
    tags,
    palette,
    loading: paletteLoading || recipesLoading,
  };
}

/**
 * Set or clear a tag's color. Passing `null` removes the override and
 * lets the heuristic fall through. The tag does NOT need to exist on a
 * recipe — calling this with a fresh name effectively creates a
 * palette-only tag that the management UI will surface.
 */
export async function setTagColor(
  uid: string,
  rawTag: string,
  tone: TagTone | null,
): Promise<void> {
  const tag = normalizeTag(rawTag);
  if (!tag) throw new Error("Tag name cannot be empty.");

  const snap = await getDoc(userDocRef(uid));
  const current = (snap.exists()
    ? ((snap.data().tagColors ?? {}) as Record<string, string>)
    : {});
  const next = { ...current };
  if (tone === null) {
    delete next[tag];
  } else {
    next[tag] = tone;
  }
  await writePalette(null, uid, current, next);
}

/**
 * Add a tag to the user's palette without touching any recipe. Useful
 * for pre-seeding tags from the management UI before applying them.
 * Defaults to "default" tone — caller can change with setTagColor.
 */
export async function addTag(uid: string, rawTag: string): Promise<string> {
  const tag = normalizeTag(rawTag);
  if (!tag) throw new Error("Tag name cannot be empty.");
  if (tag.length > 60) throw new Error("Tag is too long.");

  const snap = await getDoc(userDocRef(uid));
  const current = (snap.exists()
    ? ((snap.data().tagColors ?? {}) as Record<string, string>)
    : {});
  if (current[tag]) return tag;
  await writePalette(null, uid, current, { ...current, [tag]: "default" });
  return tag;
}

/**
 * Rename a tag everywhere — every owned recipe that carries the old
 * name gets the new one, and the palette entry (if any) moves with it.
 * Refuses to collapse into an existing tag — use mergeTags for that.
 * Only owned recipes are touched (we can't write to recipes shared
 * with us anyway).
 */
export async function renameTag(
  uid: string,
  oldRaw: string,
  newRaw: string,
): Promise<void> {
  const oldTag = normalizeTag(oldRaw);
  const newTag = normalizeTag(newRaw);
  if (!oldTag || !newTag) throw new Error("Tag name cannot be empty.");
  if (newTag.length > 60) throw new Error("Tag is too long.");
  if (oldTag === newTag) return;

  const userSnap = await getDoc(userDocRef(uid));
  const palette = (userSnap.exists()
    ? ((userSnap.data().tagColors ?? {}) as Record<string, string>)
    : {});
  if (palette[newTag]) {
    throw new Error(
      `Tag "${newTag}" already exists. Use merge instead.`,
    );
  }

  const recipesSnap = await getDocs(
    query(
      collection(db, "recipes"),
      where("ownerId", "==", uid),
      where("tags", "array-contains", oldTag),
    ),
  );

  // +1 for the user doc update.
  if (recipesSnap.size + 1 > FIRESTORE_BATCH_LIMIT) {
    throw new Error(
      `Too many recipes (${recipesSnap.size}) to rename in one batch.`,
    );
  }

  const nextPalette: Record<string, string> = { ...palette };
  if (nextPalette[oldTag]) {
    nextPalette[newTag] = nextPalette[oldTag];
    delete nextPalette[oldTag];
  }

  const batch = writeBatch(db);
  writePalette(batch, uid, palette, nextPalette);
  recipesSnap.forEach((d) => {
    const tags: string[] = d.data().tags ?? [];
    const next = Array.from(
      new Set(tags.map((t) => (normalizeTag(t) === oldTag ? newTag : t))),
    );
    batch.update(d.ref, {
      tags: next,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Delete a tag — strip it from every owned recipe that carries it and
 * remove the palette entry. Recipes that aren't owned by the user are
 * not modified (security rules wouldn't allow it).
 */
export async function deleteTag(uid: string, rawTag: string): Promise<void> {
  const tag = normalizeTag(rawTag);
  if (!tag) return;

  const userSnap = await getDoc(userDocRef(uid));
  const palette = (userSnap.exists()
    ? ((userSnap.data().tagColors ?? {}) as Record<string, string>)
    : {});

  const recipesSnap = await getDocs(
    query(
      collection(db, "recipes"),
      where("ownerId", "==", uid),
      where("tags", "array-contains", tag),
    ),
  );

  if (recipesSnap.size + 1 > FIRESTORE_BATCH_LIMIT) {
    throw new Error(
      `Too many recipes (${recipesSnap.size}) to delete in one batch.`,
    );
  }

  const nextPalette: Record<string, string> = { ...palette };
  delete nextPalette[tag];

  const batch = writeBatch(db);
  writePalette(batch, uid, palette, nextPalette);
  recipesSnap.forEach((d) => {
    const tags: string[] = d.data().tags ?? [];
    const next = tags.filter((t) => normalizeTag(t) !== tag);
    batch.update(d.ref, {
      tags: next,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Merge `source` into `target`. Every owned recipe carrying `source`
 * (and not already `target`) gets `target` appended; both are removed
 * via Set dedupe so a recipe with both ends with just `target`. The
 * source palette entry is removed; if the target has no palette entry
 * yet, it inherits the source's color so the visual identity carries
 * over.
 */
export async function mergeTags(
  uid: string,
  sourceRaw: string,
  targetRaw: string,
): Promise<void> {
  const source = normalizeTag(sourceRaw);
  const target = normalizeTag(targetRaw);
  if (!source || !target) throw new Error("Tag name cannot be empty.");
  if (source === target) throw new Error("Cannot merge a tag into itself.");

  const userSnap = await getDoc(userDocRef(uid));
  const palette = (userSnap.exists()
    ? ((userSnap.data().tagColors ?? {}) as Record<string, string>)
    : {});

  const recipesSnap = await getDocs(
    query(
      collection(db, "recipes"),
      where("ownerId", "==", uid),
      where("tags", "array-contains", source),
    ),
  );

  if (recipesSnap.size + 1 > FIRESTORE_BATCH_LIMIT) {
    throw new Error(
      `Too many recipes (${recipesSnap.size}) to merge in one batch.`,
    );
  }

  const nextPalette: Record<string, string> = { ...palette };
  // If target has no color yet, inherit source's so the merged tag
  // doesn't visibly "lose" the color the user had assigned.
  if (!nextPalette[target] && nextPalette[source]) {
    nextPalette[target] = nextPalette[source];
  }
  delete nextPalette[source];

  const batch = writeBatch(db);
  writePalette(batch, uid, palette, nextPalette);
  recipesSnap.forEach((d) => {
    const tags: string[] = d.data().tags ?? [];
    const next = Array.from(
      new Set(tags.map((t) => (normalizeTag(t) === source ? target : t))),
    );
    batch.update(d.ref, {
      tags: next,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
