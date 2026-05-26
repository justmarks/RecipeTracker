import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { parseMarkdown } from "../lib/importMarkdown";
import { RecipeForm } from "../components/RecipeForm";

type ImportFromUrlResponse = { recipe: Partial<RecipeInput> };

const callImportFromUrl = httpsCallable<{ url: string }, ImportFromUrlResponse>(
  functions,
  "importFromUrl",
);

export function Import() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sharedUrl = params.get("url") ?? params.get("text") ?? "";

  const [urlInput, setUrlInput] = useState(sharedUrl);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [markdownText, setMarkdownText] = useState("");
  const [parsed, setParsed] = useState<Partial<RecipeInput> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Pre-fill the URL input when share-target dropped us here with ?url=…
  useEffect(() => {
    if (sharedUrl && /^https?:\/\//i.test(sharedUrl)) {
      setUrlInput(sharedUrl);
    }
  }, [sharedUrl]);

  // If a share-target URL is present and the user hasn't yet parsed anything,
  // skip straight to the URL fetcher view (no markdown affordance) — they
  // shared a URL, that's what they want to import.
  const showOnlyUrlFetcher = useMemo(
    () => Boolean(sharedUrl && /^https?:\/\//i.test(sharedUrl)) && !parsed,
    [sharedUrl, parsed],
  );

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function handleFetchUrl() {
    const url = urlInput.trim();
    setUrlError(null);
    if (!/^https?:\/\//i.test(url)) {
      setUrlError("Enter a valid http(s) URL.");
      return;
    }
    setFetchingUrl(true);
    try {
      const result = await callImportFromUrl({ url });
      setParsed(result.data.recipe);
    } catch (err) {
      console.error("importFromUrl:", err);
      const message = err instanceof Error ? err.message : String(err);
      setUrlError(message);
    } finally {
      setFetchingUrl(false);
    }
  }

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

  function handleParseMarkdown() {
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

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Import a recipe</h1>

      {parsed ? (
        <div className="mt-6">
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Review the parsed recipe below and save when you&apos;re happy with it.
          </p>
          <RecipeForm
            initial={parsed}
            submitLabel="Save imported recipe"
            onSubmit={onSubmit}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* URL → AI import */}
          <section className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Import from URL (AI-assisted)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/some-recipe"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleFetchUrl}
                disabled={fetchingUrl || !urlInput.trim()}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {fetchingUrl ? "Fetching…" : "Fetch with AI"}
              </button>
            </div>
            {urlError && <p className="text-sm text-red-600">{urlError}</p>}
            <p className="text-xs text-slate-500">
              We fetch the page and ask Claude to extract the recipe. Review the
              result before saving.
            </p>
          </section>

          {!showOnlyUrlFetcher && (
            <>
              <div className="text-center text-xs uppercase tracking-wide text-slate-400">
                — or paste / upload markdown —
              </div>

              <section className="space-y-3">
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

                <textarea
                  rows={10}
                  value={markdownText}
                  onChange={(e) => setMarkdownText(e.target.value)}
                  placeholder={`# Title\n\nSource: https://example.com\nYield: 4 servings\n\n## Ingredients\n- 1 cup flour\n- 2 eggs\n\n## Instructions\n1. Mix\n2. Bake\n`}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                />

                {parseError && <p className="text-sm text-red-600">{parseError}</p>}

                <button
                  type="button"
                  disabled={!markdownText.trim()}
                  onClick={handleParseMarkdown}
                  className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Parse markdown
                </button>
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
