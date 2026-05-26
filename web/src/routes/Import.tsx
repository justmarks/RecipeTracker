import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { parseMarkdown } from "../lib/importMarkdown";
import { RecipeForm } from "../components/RecipeForm";

export function Import() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sharedUrl = params.get("url") ?? params.get("text") ?? "";

  const [markdownText, setMarkdownText] = useState("");
  const [parsed, setParsed] = useState<Partial<RecipeInput> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // If the route was opened via share-target with a URL, jump straight to the
  // form pre-filled with the source URL. The AI-extraction path (URL → full
  // recipe) lands in a follow-up slice; for now the user fills in the rest.
  const shareTargetInitial = useMemo<Partial<RecipeInput> | null>(() => {
    if (!sharedUrl || !/^https?:\/\//i.test(sharedUrl)) return null;
    return { source: { type: "url", url: sharedUrl } };
  }, [sharedUrl]);

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function handleFileUpload(file: File) {
    try {
      const text = await file.text();
      setMarkdownText(text);
      setParsed(parseMarkdown(text));
      setParseError(null);
    } catch (err) {
      console.error("File read:", err);
      setParseError(err instanceof Error ? err.message : "Failed to read file");
    }
  }

  function handleParse() {
    try {
      setParsed(parseMarkdown(markdownText));
      setParseError(null);
    } catch (err) {
      console.error("Parse markdown:", err);
      setParseError(err instanceof Error ? err.message : "Failed to parse");
    }
  }

  async function onSubmit(input: RecipeInput) {
    const docRef = await addDoc(collection(db, "recipes"), {
      ...input,
      ownerId: user!.uid,
      sharedWith: [],
      searchTokens: buildSearchTokens(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigate(`/recipes/${docRef.id}`);
  }

  // Form view: either share-target with a URL, or markdown was just parsed.
  const formInitial = parsed ?? shareTargetInitial;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Import a recipe</h1>

      {formInitial ? (
        <div className="mt-6">
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {parsed
              ? "Review the parsed recipe below and save when you're happy with it."
              : "Shared URL pre-filled below. Add the rest manually for now — AI-assisted URL import is coming next."}
          </p>
          <RecipeForm
            initial={formInitial}
            submitLabel="Save imported recipe"
            onSubmit={onSubmit}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Upload a markdown file
            </label>
            <input
              type="file"
              accept=".md,.markdown,text/markdown"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="mt-1 block w-full text-sm"
            />
          </div>

          <div className="text-center text-xs uppercase tracking-wide text-slate-400">
            — or paste markdown —
          </div>

          <textarea
            rows={12}
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder={`# Title\n\nSource: https://example.com\nYield: 4 servings\n\n## Ingredients\n- 1 cup flour\n- 2 eggs\n\n## Instructions\n1. Mix\n2. Bake\n`}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
          />

          {parseError && <p className="text-sm text-red-600">{parseError}</p>}

          <button
            type="button"
            disabled={!markdownText.trim()}
            onClick={handleParse}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Parse markdown
          </button>
        </div>
      )}
    </main>
  );
}
