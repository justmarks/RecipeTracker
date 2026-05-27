import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { parseMarkdown } from "../lib/importMarkdown";
import { RecipeForm } from "../components/RecipeForm";
import {
  Button,
  Eyebrow,
  Field,
  Icon,
  Input,
  Textarea,
} from "../components/ui";

type ImportFromUrlResponse = { recipe: Partial<RecipeInput> };

const callImportFromUrl = httpsCallable<{ url: string }, ImportFromUrlResponse>(
  functions,
  "importFromUrl",
);

const MARKDOWN_PLACEHOLDER = `# Title

Source: https://example.com
Yield: 4 servings

## Ingredients
- 1 cup flour
- 2 eggs

## Instructions
1. Mix
2. Bake`;

/**
 * Import view — the kit's two-path card layout. Top card is the
 * AI-from-URL fetcher; a faint divider separates it from the
 * markdown paste / upload fallback. Share-target landings with a
 * URL hide the markdown affordance to keep the user on the
 * single-task path.
 */
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

  useEffect(() => {
    if (sharedUrl && /^https?:\/\//i.test(sharedUrl)) {
      setUrlInput(sharedUrl);
    }
  }, [sharedUrl]);

  // When share-target supplied a URL and we haven't parsed yet, keep the
  // page focused on the URL fetcher — the user came here intending to
  // import that URL, not to paste markdown.
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
    <div className="mx-auto max-w-[640px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={() => navigate(parsed ? "/" : "/")}
        className="px-0 mb-4"
      >
        Back
      </Button>

      {parsed ? (
        <>
          <h1 className="font-display text-[32px] sm:text-[38px] font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-2">
            Review imported recipe
          </h1>

          <div className="mb-5 flex items-start gap-2.5 rounded-md bg-saffron-100 px-3.5 py-3 text-saffron-700 font-sans text-[13px]">
            <span className="shrink-0 mt-0.5">
              <Icon name="sparkles" size={16} />
            </span>
            <span>
              Claude returned the recipe below.  Tweak anything that looks off, then save.
            </span>
          </div>

          <RecipeForm
            initial={parsed}
            submitLabel="Save imported recipe"
            onSubmit={onSubmit}
            onCancel={() => {
              setParsed(null);
              setParseError(null);
            }}
          />
        </>
      ) : (
        <>
          <h1 className="font-display text-[32px] sm:text-[38px] font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-2">
            Import a recipe
          </h1>
          <p className="font-sans text-sm text-ink-700 m-0 mb-7">
            Paste a URL and Claude will extract the recipe. You&apos;ll
            review before saving.
          </p>

          <section className="bg-white rounded-lg px-6 py-5 shadow-sm border border-[var(--border-faint)] mb-5">
            <Eyebrow className="mb-3 flex items-center gap-1.5">
              <span className="text-tomato-500">
                <Icon name="sparkles" size={11} />
              </span>
              Extract w/AI from URL
            </Eyebrow>
            <div className="flex gap-2">
              <Input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://cooking.nytimes.com/…"
              />
              <Button
                type="button"
                variant="primary"
                onClick={handleFetchUrl}
                disabled={fetchingUrl || !urlInput.trim()}
              >
                {fetchingUrl ? "Fetching…" : "Fetch"}
              </Button>
            </div>
            {urlError && (
              <p className="mt-2 font-sans text-[13px] text-tomato-700">
                {urlError}
              </p>
            )}
            <p className="mt-2 font-sans text-xs text-ink-500">
              We will extract the recipe using Claude and allow you to review the results before saving.
            </p>
          </section>

          {!showOnlyUrlFetcher && (
            <>
              <div className="my-6 flex items-center gap-3 text-ink-300 font-sans text-[11px] uppercase tracking-[0.12em]">
                <div className="flex-1 h-px bg-paper-300" />
                <span>or paste markdown</span>
                <div className="flex-1 h-px bg-paper-300" />
              </div>

              <section>
                <Field
                  label="Markdown"
                  hint="One recipe per file. Use ## Ingredients / ## Instructions / ## Notes sections."
                >
                  <Textarea
                    mono
                    rows={10}
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    placeholder={MARKDOWN_PLACEHOLDER}
                  />
                </Field>
                {parseError && (
                  <p className="mt-2 font-sans text-[13px] text-tomato-700">
                    {parseError}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    icon="file-text"
                    onClick={handleParseMarkdown}
                    disabled={!markdownText.trim()}
                  >
                    Parse markdown
                  </Button>
                  <label className="cursor-pointer font-sans text-[13px] text-tomato-600 hover:text-tomato-700 inline-flex items-center gap-1.5">
                    <Icon name="upload" size={14} />
                    Upload .md file
                    <input
                      type="file"
                      accept=".md,.markdown,text/markdown"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
