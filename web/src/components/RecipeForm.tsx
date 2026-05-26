import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { RecipeInputSchema, CATEGORIES } from "shared";
import type { Category, RecipeInput, Section } from "shared";

interface Props {
  initial?: RecipeInput;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}

export function RecipeForm({ initial, submitLabel, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "entree");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [sourceUrl, setSourceUrl] = useState(
    initial?.source?.type === "url" ? initial.source.url : "",
  );
  const [ingredientsText, setIngredientsText] = useState(
    initial ? sectionsToText(initial.ingredients) : "",
  );
  const [instructionsText, setInstructionsText] = useState(
    initial ? sectionsToText(initial.instructions) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [yieldField, setYieldField] = useState(initial?.yield ?? "");
  const [prepTime, setPrepTime] = useState(initial?.prepTime ?? "");
  const [cookTime, setCookTime] = useState(initial?.cookTime ?? "");
  const [totalTime, setTotalTime] = useState(initial?.totalTime ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Field label="Title">
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tags (comma-separated)">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vegetarian, gluten-free"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </Field>
      </div>

      <Field label="Source URL (optional)">
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </Field>

      <Field label="Ingredients (one per line; use ## Heading for sections)">
        <textarea
          required
          rows={8}
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
        />
      </Field>

      <Field label="Instructions (one step per line; use ## Heading for sections)">
        <textarea
          required
          rows={8}
          value={instructionsText}
          onChange={(e) => setInstructionsText(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Yield">
          <input
            type="text"
            value={yieldField}
            onChange={(e) => setYieldField(e.target.value)}
            placeholder="4 servings"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </Field>
        <Field label="Prep time">
          <input
            type="text"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="20 min"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </Field>
        <Field label="Cook time">
          <input
            type="text"
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            placeholder="40 min"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </Field>
        <Field label="Total time">
          <input
            type="text"
            value={totalTime}
            onChange={(e) => setTotalTime(e.target.value)}
            placeholder="1 hr"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
