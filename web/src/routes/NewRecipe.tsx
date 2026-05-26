import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, Navigate, Link } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import {
  RecipeInputSchema,
  CATEGORIES,
  buildSearchTokens,
} from "shared";
import type { Category, Section } from "shared";

export function NewRecipe() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("entree");
  const [tags, setTags] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [instructionsText, setInstructionsText] = useState("");
  const [notes, setNotes] = useState("");
  const [yieldField, setYieldField] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [totalTime, setTotalTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  function parseSections(text: string): Section[] {
    const items = text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length === 0 ? [] : [{ heading: null, items }];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input = {
      title: title.trim(),
      source: sourceUrl.trim() ? { type: "url" as const, url: sourceUrl.trim() } : undefined,
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
      const docRef = await addDoc(collection(db, "recipes"), {
        ...parsed.data,
        ownerId: user!.uid,
        sharedWith: [],
        searchTokens: buildSearchTokens(parsed.data),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate(`/recipes/${docRef.id}`);
    } catch (err) {
      console.error("Save recipe:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">New recipe</h1>

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

        <Field label="Ingredients (one per line)">
          <textarea
            required
            rows={6}
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </Field>

        <Field label="Instructions (one step per line)">
          <textarea
            required
            rows={6}
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
            {saving ? "Saving…" : "Save recipe"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
