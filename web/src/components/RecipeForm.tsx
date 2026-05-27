import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { RecipeInputSchema } from "shared";
import type { RecipeInput, Section } from "shared";
import { useAuth } from "../lib/useAuth";
import { addChapter, useChapters } from "../lib/categories";
import { Button, Field, Input, Textarea } from "./ui";

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
}

// Native <select> doesn't pick up the Input primitive's styling, so we
// keep the canonical class string here and reuse it for both selects
// (chapter + rating). Extract to a Select primitive once a third place
// needs it.
const SELECT_CLASSES = [
  "w-full font-sans text-sm text-ink-900 bg-white",
  "border border-paper-400 rounded-md px-3 py-2.5",
  "outline-none transition-colors duration-100 ease-out cursor-pointer",
  "focus:border-tomato-500 focus:shadow-[var(--shadow-focus)]",
  "disabled:bg-paper-200 disabled:text-ink-500 disabled:cursor-not-allowed",
].join(" ");

/**
 * Shared form for creating, editing, and saving AI-imported recipes.
 * Page chrome (back button + h1) lives in the wrapper routes
 * (NewRecipe / EditRecipe / Import); this component only renders the
 * fields and the action row.
 */
export function RecipeForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const { user } = useAuth();
  const { chapters, loading: chaptersLoading } = useChapters(user?.uid);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [sourceUrl, setSourceUrl] = useState(
    initial?.source?.type === "url" ? initial.source.url : "",
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
      setNewChapterName("");
      setShowAddChapter(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add chapter.");
    } finally {
      setAddingChapter(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input = {
      title: title.trim(),
      source: sourceUrl.trim()
        ? { type: "url" as const, url: sourceUrl.trim() }
        : undefined,
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
    } catch (err) {
      console.error("Save:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Chapter">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={chaptersLoading || chapters.length === 0}
            className={`${SELECT_CLASSES} capitalize`}
          >
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
            onChange={(e) => setTags(e.target.value)}
            placeholder="vegetarian, gluten-free"
          />
        </Field>
      </div>

      <Field
        label="Source URL"
        hint="A link to the original recipe, if any."
      >
        <Input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
        />
      </Field>

      <Field
        label="Photo URL"
        hint="A direct image link. URL imports auto-fill this when the site sets og:image."
      >
        <Input
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://...jpg"
        />
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
          onChange={(e) => setIngredientsText(e.target.value)}
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
          onChange={(e) => setInstructionsText(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Yield">
          <Input
            value={yieldField}
            onChange={(e) => setYieldField(e.target.value)}
            placeholder="4 servings"
          />
        </Field>
        <Field label="Prep">
          <Input
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="20 min"
          />
        </Field>
        <Field label="Cook">
          <Input
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            placeholder="40 min"
          />
        </Field>
        <Field label="Total">
          <Input
            value={totalTime}
            onChange={(e) => setTotalTime(e.target.value)}
            placeholder="1 hr"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Rating">
          <select
            value={rating}
            onChange={(e) =>
              setRating(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={SELECT_CLASSES}
          >
            <option value="">—</option>
            <option value="1">★</option>
            <option value="2">★ ★</option>
            <option value="3">★ ★ ★</option>
            <option value="4">★ ★ ★ ★</option>
            <option value="5">★ ★ ★ ★ ★</option>
          </select>
        </Field>
        <Field label="Last made">
          <Input
            type="date"
            value={lastMadeDate}
            onChange={(e) => setLastMadeDate(e.target.value)}
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
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && (
        <div className="rounded-md px-4 py-3 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
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

function parseSections(text: string): Section[] {
  // Classify each line: did it originally have a bullet/number marker?
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const stripped = stripListMarker(raw);
      return { hadMarker: stripped !== raw, text: stripped };
    });

  // Heuristic: if ANY line was bulleted/numbered, treat unmarked lines as
  // section headings. This catches real-world pastes like:
  //   • 1 cup flour
  //   • 2 eggs
  //   AVOCADO GODDESS SAUCE   ← unmarked among bullets → heading
  //   • 1 avocado
  // Falls back to "## Heading" for inputs that don't use bullets at all.
  const anyMarkers = lines.some((l) => l.hadMarker);

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const explicit = line.text.match(/^#{1,3}\s+(.+?):?$/);
    const isHeuristic = anyMarkers && !line.hadMarker && !explicit;

    if (explicit || isHeuristic) {
      if (current && current.items.length > 0) sections.push(current);
      const heading = explicit
        ? explicit[1].trim()
        : line.text.replace(/:$/, "").trim();
      current = { heading, items: [] };
    } else {
      if (!current) current = { heading: null, items: [] };
      current.items.push(line.text);
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
