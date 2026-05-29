import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { RecipeInputSchema } from "shared";
import type { RecipeInput, Section } from "shared";
import { useAuth } from "../lib/useAuth";
import { addChapter, useChapters } from "../lib/categories";
import { uploadRecipePhoto } from "../lib/storage";
import { Button, Field, Input, Select, Textarea } from "./ui";

interface Props {
  /**
   * Partial so the import flow can pre-fill whatever it managed to parse
   * without having to invent values for fields that weren't in the source.
   */
  initial?: Partial<RecipeInput>;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
  /** Optional Cancel handler — shows a ghost Cancel button next to Save. */
  onCancel?: () => void;
  /**
   * Fired with `true` the first time the user changes any field, and
   * with `false` after a successful submit. Lets the parent wrap
   * navigation with a "discard changes?" confirmation.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Shared form for creating, editing, and saving AI-imported recipes.
 * Page chrome (back button + h1) lives in the wrapper routes
 * (NewRecipe / EditRecipe / Import); this component only renders the
 * fields and the action row.
 *
 * Tracks a dirty flag internally and pushes changes to onDirtyChange
 * so parent wrappers can prompt before navigating away. Reset to
 * clean on a successful submit.
 */
export function RecipeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDirtyChange,
}: Props) {
  const { user } = useAuth();
  const { chapters, loading: chaptersLoading } = useChapters(user?.uid);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  // Source is a discriminated union ({type: "url", url} | {type: "book",
  // title, author?, page?}). We keep separate state for both branches
  // so the user can flip the toggle back and forth without losing
  // their typed values; only the active branch is emitted on submit.
  const [sourceType, setSourceType] = useState<"url" | "book">(
    initial?.source?.type === "book" ? "book" : "url",
  );
  const [sourceUrl, setSourceUrl] = useState(
    initial?.source?.type === "url" ? initial.source.url : "",
  );
  const [sourceBookTitle, setSourceBookTitle] = useState(
    initial?.source?.type === "book" ? initial.source.title : "",
  );
  const [sourceBookAuthor, setSourceBookAuthor] = useState(
    initial?.source?.type === "book" ? (initial.source.author ?? "") : "",
  );
  const [sourceBookPage, setSourceBookPage] = useState(
    initial?.source?.type === "book" ? (initial.source.page ?? "") : "",
  );
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [ingredientsText, setIngredientsText] = useState(
    initial?.ingredients ? sectionsToText(initial.ingredients) : "",
  );
  const [instructionsText, setInstructionsText] = useState(
    initial?.instructions ? sectionsToText(initial.instructions) : "",
  );
  const [yieldField, setYieldField] = useState(initial?.yield ?? "");
  const [prepTime, setPrepTime] = useState(initial?.prepTime ?? "");
  const [cookTime, setCookTime] = useState(initial?.cookTime ?? "");
  const [totalTime, setTotalTime] = useState(initial?.totalTime ?? "");
  const [rating, setRating] = useState<number | "">(initial?.rating ?? "");
  const [lastMadeDate, setLastMadeDate] = useState(initial?.lastMadeDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [addingChapter, setAddingChapter] = useState(false);

  // Photo upload state
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Dirty tracking — set on first user input, cleared on submit success.
  // Initial-state assignment via useState / category-default useEffect do
  // NOT route through markDirty, so opening the form doesn't flag it dirty.
  const [isDirty, setIsDirty] = useState(false);
  function markDirty() {
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange?.(true);
    }
  }

  // Once chapters load, settle on a sensible default:
  //   - keep an existing match (round-trip on edit, AI import that matched a seed)
  //   - if the case differs (AI returned "entree" but chapter is "Entree"),
  //     swap in the canonical chapter case
  //   - otherwise pick the first chapter
  useEffect(() => {
    if (chaptersLoading || chapters.length === 0) return;
    if (!category) {
      setCategory(chapters[0]);
      return;
    }
    const match = chapters.find(
      (c) => c.toLowerCase() === category.toLowerCase(),
    );
    setCategory(match ?? chapters[0]);
  }, [chapters, chaptersLoading, category]);

  async function handleAddChapter() {
    if (!user) return;
    const name = newChapterName.trim();
    if (!name) return;
    setAddingChapter(true);
    setError(null);
    try {
      const normalized = await addChapter(user.uid, name);
      setCategory(normalized);
      markDirty();
      setNewChapterName("");
      setShowAddChapter(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add chapter.");
    } finally {
      setAddingChapter(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!user) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      const url = await uploadRecipePhoto(file, user.uid);
      setPhotoUrl(url);
      markDirty();
    } catch (err) {
      console.error("Photo upload:", err);
      setPhotoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingPhoto(false);
      // Allow re-selecting the same file (browsers ignore change when value
      // hasn't moved). Clearing the input value resets that.
      if (photoFileRef.current) photoFileRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Emit only the active source-type's data. The other branch's state
    // is retained in case the user toggles back, but never persisted.
    // ignoreUndefinedProperties on the Firestore client drops any
    // undefined fields (empty author / page) cleanly.
    const trimmedBookTitle = sourceBookTitle.trim();
    const trimmedBookAuthor = sourceBookAuthor.trim();
    const trimmedBookPage = sourceBookPage.trim();
    let source: RecipeInput["source"];
    if (sourceType === "url" && sourceUrl.trim()) {
      source = { type: "url", url: sourceUrl.trim() };
    } else if (sourceType === "book" && trimmedBookTitle) {
      source = {
        type: "book",
        title: trimmedBookTitle,
        author: trimmedBookAuthor || undefined,
        page: trimmedBookPage || undefined,
      };
    }

    const input = {
      title: title.trim(),
      source,
      ingredients: parseSections(ingredientsText),
      instructions: parseSections(instructionsText),
      notes: notes.trim() || undefined,
      yield: yieldField.trim() || undefined,
      prepTime: prepTime.trim() || undefined,
      cookTime: cookTime.trim() || undefined,
      totalTime: totalTime.trim() || undefined,
      category,
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      photoUrl: photoUrl.trim() || undefined,
      rating: rating === "" ? undefined : Number(rating),
      lastMadeDate: lastMadeDate || undefined,
    };

    const parsed = RecipeInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsed.data);
      // Clear the dirty flag BEFORE the parent navigates so any
      // outer "discard?" check sees a clean form.
      setIsDirty(false);
      onDirtyChange?.(false);
    } catch (err) {
      console.error("Save:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // Helper to wrap an onChange so it also marks dirty. Saves verbosity
  // across 12+ form fields.
  function onChangeText<E extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    setter: (v: string) => void,
  ): (e: React.ChangeEvent<E>) => void {
    return (e) => {
      setter(e.target.value);
      markDirty();
    };
  }

  return (
    // pb-28 leaves room for the fixed action bar at the viewport bottom so
    // the last field doesn't disappear under it on short forms.
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px] pb-28">
      <Field label="Title">
        <Input
          value={title}
          onChange={onChangeText(setTitle)}
          required
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Chapter">
          <Select
            value={category}
            onChange={onChangeText(setCategory)}
            disabled={chaptersLoading || chapters.length === 0}
            className="capitalize"
          >
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <AddChapterRow
            show={showAddChapter}
            value={newChapterName}
            adding={addingChapter}
            onShow={() => setShowAddChapter(true)}
            onChange={setNewChapterName}
            onAdd={handleAddChapter}
            onCancel={() => {
              setShowAddChapter(false);
              setNewChapterName("");
            }}
          />
        </Field>
        <Field label="Tags" hint="Comma-separated, e.g. vegetarian, weeknight">
          <Input
            value={tags}
            onChange={onChangeText(setTags)}
            placeholder="vegetarian, gluten-free"
          />
        </Field>
      </div>

      <Field
        label="Source"
        hint={
          sourceType === "url"
            ? "A link to the original recipe, if any."
            : "The book this recipe came from. Author and page are optional."
        }
      >
        <div className="flex flex-col gap-2">
          <div
            role="radiogroup"
            aria-label="Source type"
            className="inline-flex self-start rounded-md border border-paper-400 bg-white p-0.5"
          >
            <SourceTypeButton
              active={sourceType === "url"}
              onClick={() => {
                if (sourceType === "url") return;
                setSourceType("url");
                markDirty();
              }}
            >
              URL
            </SourceTypeButton>
            <SourceTypeButton
              active={sourceType === "book"}
              onClick={() => {
                if (sourceType === "book") return;
                setSourceType("book");
                markDirty();
              }}
            >
              Book
            </SourceTypeButton>
          </div>
          {sourceType === "url" ? (
            <Input
              type="url"
              value={sourceUrl}
              onChange={onChangeText(setSourceUrl)}
              placeholder="https://..."
            />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={sourceBookTitle}
                onChange={onChangeText(setSourceBookTitle)}
                placeholder="Book title"
                className="flex-1"
              />
              <Input
                value={sourceBookAuthor}
                onChange={onChangeText(setSourceBookAuthor)}
                placeholder="Author"
                className="flex-1"
              />
              <Input
                value={sourceBookPage}
                onChange={onChangeText(setSourceBookPage)}
                placeholder="Page"
                className="sm:w-24"
              />
            </div>
          )}
        </div>
      </Field>

      <Field
        label="Photo"
        hint="Paste a direct image URL, or upload from your device (max 10MB)."
      >
        <div className="flex gap-2">
          <Input
            type="url"
            value={photoUrl}
            onChange={onChangeText(setPhotoUrl)}
            placeholder="https://...jpg"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            icon="upload"
            onClick={() => photoFileRef.current?.click()}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={photoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoUpload(f);
            }}
          />
        </div>
        {photoError && (
          <p className="mt-1 font-sans text-[12px] text-tomato-700">
            {photoError}
          </p>
        )}
        {photoUrl && !photoError && (
          <img
            src={photoUrl}
            alt=""
            className="mt-2 max-h-40 rounded-md border border-paper-300 object-cover"
            loading="lazy"
          />
        )}
      </Field>

      <Field
        label="Ingredients"
        hint="One per line. Use ## Heading for sections (e.g. ## For the sauce)."
      >
        <Textarea
          mono
          required
          rows={8}
          value={ingredientsText}
          onChange={onChangeText(setIngredientsText)}
        />
      </Field>

      <Field
        label="Instructions"
        hint="One step per line. Use ## Heading for sections."
      >
        <Textarea
          required
          rows={8}
          value={instructionsText}
          onChange={onChangeText(setInstructionsText)}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Yield">
          <Input
            value={yieldField}
            onChange={onChangeText(setYieldField)}
            placeholder="4 servings"
          />
        </Field>
        <Field label="Prep">
          <Input
            value={prepTime}
            onChange={onChangeText(setPrepTime)}
            placeholder="20 min"
          />
        </Field>
        <Field label="Cook">
          <Input
            value={cookTime}
            onChange={onChangeText(setCookTime)}
            placeholder="40 min"
          />
        </Field>
        <Field label="Total">
          <Input
            value={totalTime}
            onChange={onChangeText(setTotalTime)}
            placeholder="1 hr"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Rating">
          <Select
            value={rating}
            onChange={(e) => {
              setRating(e.target.value === "" ? "" : Number(e.target.value));
              markDirty();
            }}
          >
            <option value="">—</option>
            <option value="1">★</option>
            <option value="2">★ ★</option>
            <option value="3">★ ★ ★</option>
            <option value="4">★ ★ ★ ★</option>
            <option value="5">★ ★ ★ ★ ★</option>
          </Select>
        </Field>
        <Field label="Last made">
          <Input
            type="date"
            value={lastMadeDate}
            onChange={onChangeText(setLastMadeDate)}
          />
        </Field>
      </div>

      <Field
        label="Notes"
        hint="Markdown supported — **bold**, [links](url), paragraphs."
      >
        <Textarea
          rows={4}
          value={notes}
          onChange={onChangeText(setNotes)}
        />
      </Field>

      {error && (
        <div className="rounded-md px-4 py-3 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100">
          {error}
        </div>
      )}

      {/*
        Sticky action bar — locked to the viewport bottom per the design
        system's RecipeForm pattern (see ui_kits/web/RecipeForm.jsx).
        Inset from the left by the 260px sidebar on lg+, full-width on
        mobile. Semi-transparent paper-100 plus a backdrop blur keeps the
        form content visible behind it as the user scrolls — the only
        place the system permits backdrop-filter blur is exactly this
        kind of pass-through chrome.
      */}
      <div
        className={[
          "fixed bottom-0 left-0 right-0 lg:left-[260px] z-10",
          "border-t border-[var(--border-default)]",
          "bg-[rgba(251,246,238,0.92)] backdrop-blur-md",
          "px-6 py-3.5 lg:px-10",
        ].join(" ")}
      >
        <div className="mx-auto max-w-[720px] flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={saving || chaptersLoading || chapters.length === 0}
          >
            {saving ? "Saving…" : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

interface AddChapterRowProps {
  show: boolean;
  value: string;
  adding: boolean;
  onShow: () => void;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

function AddChapterRow({
  show,
  value,
  adding,
  onShow,
  onChange,
  onAdd,
  onCancel,
}: AddChapterRowProps) {
  if (!show) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="font-sans text-xs font-medium text-tomato-600 hover:text-tomato-700 mt-1.5 self-start"
      >
        + Add new chapter
      </button>
    );
  }
  return (
    <div className="mt-2 flex gap-2 items-center">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. dessert"
        autoFocus
        className="flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
      />
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={onAdd}
        disabled={adding || !value.trim()}
      >
        {adding ? "Adding…" : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * Tiny segmented-control button for the URL/Book source-type toggle.
 * Local to this file because it's only used here and the design system
 * doesn't have a generic SegmentedControl primitive yet — promote it
 * to web/src/components/ui/ if a second use case comes up.
 */
function SourceTypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        "px-3 py-1 rounded text-xs font-sans font-semibold transition-colors duration-100",
        active
          ? "bg-tomato-500 text-white"
          : "text-ink-700 hover:bg-paper-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function parseSections(text: string): Section[] {
  // Each non-blank line becomes one item, unless it's marked as an
  // explicit sub-heading via "## Foo" (hash form) or "**Foo**" (bold
  // form). Round-trips of imported recipes already include `## `
  // prefixes via sectionsToText below, so no regression there.
  //
  // We intentionally do NOT try to auto-detect sub-headings from
  // unmarked short lines — the previous version did, and it would
  // silently drop multi-paragraph prose whenever any other line in
  // the textarea happened to have a bullet marker. If a user wants
  // sub-sections, they prefix with `##` or `**`; otherwise every
  // line is preserved as an item.
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => stripListMarker(raw));

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    // Hash-only heading detection. We DELIBERATELY do not treat
    // `**Bold line**` as a heading here, even though the importer's
    // parseItemsWithSubsections does — that detection silently drops
    // content when a user has a bold-wrapped line as an item, e.g.
    //
    //     1 cup flour
    //     **Important: don't sift**     ← would become a heading
    //     **Use cold butter**           ← also a heading, zero-item
    //                                     section above gets DROPPED
    //
    // sectionsToText round-trips headings as `## Foo`, so this won't
    // regress edits of recipes that already have sub-headings. Users
    // creating a new sub-section in the form should use `##` explicitly.
    const explicit = line.match(/^#{1,3}\s+(.+?):?$/);

    if (explicit) {
      if (current && current.items.length > 0) sections.push(current);
      current = { heading: explicit[1].trim(), items: [] };
    } else {
      if (!current) current = { heading: null, items: [] };
      current.items.push(line);
    }
  }
  if (current && current.items.length > 0) sections.push(current);
  return sections;
}

function sectionsToText(sections: Section[]): string {
  return sections
    .map((section) => {
      const heading = section.heading ? `## ${section.heading}\n` : "";
      return heading + section.items.join("\n");
    })
    .join("\n\n");
}

function stripListMarker(line: string): string {
  return line
    .trim()
    .replace(/^[•\-*–—·]\s+/, "")
    .trim()
    .replace(/^\(?\d+[.)]\s+/, "")
    .trim();
}
