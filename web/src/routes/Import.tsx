import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useToast } from "../lib/useToast";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { parseMarkdown } from "../lib/importMarkdown";
import { RecipeForm } from "../components/RecipeForm";
import { Button, Eyebrow, Icon, Input, Textarea } from "../components/ui";
import type { IconName } from "../components/ui";
import type { ReactNode } from "react";

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
 * Import view — two co-equal ImportCards stacked vertically, matching the
 * kit. Top card: AI-from-URL fetcher. Bottom card: markdown paste with an
 * upload affordance. Share-target landings with a URL hide the markdown
 * card to keep the user on the single-task path.
 *
 * Each card follows the same shape: tomato-tinted eyebrow with small icon,
 * full-width input, hint paragraph below, then the primary action button
 * sits at the bottom-left (not inline with the input).
 */
export function Import() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const sharedUrl = params.get("url") ?? params.get("text") ?? "";

  const [urlInput, setUrlInput] = useState(sharedUrl);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [markdownText, setMarkdownText] = useState("");
  const [parsed, setParsed] = useState<Partial<RecipeInput> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const mdFileRef = useRef<HTMLInputElement>(null);

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
      sharedWithDetails: [],
      searchTokens: buildSearchTokens(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    toast.show(`Saved "${input.title}"`);
    // replace so Back skips the import form and goes home.
    navigate(`/recipes/${docRef.id}`, { replace: true });
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
            Two ways to bring a recipe in. Either works — review the result
            before saving.
          </p>

          {isIOS() && (
            <div className="mb-5 flex items-start gap-2.5 rounded-md bg-paper-200 px-3.5 py-3 text-ink-700 font-sans text-[13px]">
              <span className="shrink-0 mt-0.5 text-ink-500">
                <Icon name="link" size={14} />
              </span>
              <span>
                On iPhone / iPad, the system share sheet can't open this
                app directly — Safari doesn't support it yet. Copy the
                recipe URL from your browser and paste it below.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <ImportCard
              eyebrowIcon="sparkles"
              eyebrow="Extract w/AI from URL"
              hint="We fetch the page and ask Claude to pull the recipe out."
              error={urlError}
              action={
                <Button
                  type="button"
                  variant="primary"
                  icon="sparkles"
                  onClick={handleFetchUrl}
                  disabled={fetchingUrl || !urlInput.trim()}
                >
                  {fetchingUrl ? "Fetching…" : "Fetch with AI"}
                </Button>
              }
            >
              <Input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://cooking.nytimes.com/…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && urlInput.trim() && !fetchingUrl) {
                    e.preventDefault();
                    handleFetchUrl();
                  }
                }}
              />
            </ImportCard>

            {!showOnlyUrlFetcher && (
              <ImportCard
                eyebrowIcon="file-text"
                eyebrow="From markdown"
                hint="Paste a markdown recipe, or upload a .md file. Use ## Ingredients / ## Instructions / ## Notes sections."
                error={parseError}
                action={
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      icon="check"
                      onClick={handleParseMarkdown}
                      disabled={!markdownText.trim()}
                    >
                      Parse markdown
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      icon="upload"
                      onClick={() => mdFileRef.current?.click()}
                    >
                      Upload .md file
                    </Button>
                    <input
                      ref={mdFileRef}
                      type="file"
                      accept=".md,.markdown,text/markdown"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        if (mdFileRef.current) mdFileRef.current.value = "";
                      }}
                      className="hidden"
                    />
                  </div>
                }
              >
                <Textarea
                  mono
                  rows={8}
                  value={markdownText}
                  onChange={(e) => setMarkdownText(e.target.value)}
                  placeholder={MARKDOWN_PLACEHOLDER}
                />
              </ImportCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Detect iOS Safari / Chrome / Firefox — all three use WebKit under the
 * hood and none of them implement the Web Share Target API. When this
 * returns true we show a "copy the URL and paste it here" hint so users
 * understand why MarksRecipeBook doesn't appear in their share sheet.
 *
 * Modern iPadOS reports "MacIntel" as platform with touch support — we
 * detect that case explicitly. Desktop Safari is unaffected (its share
 * sheet is identical to iOS but PWA install isn't the use case there).
 *
 * @return {boolean} True when the running browser is an iOS WebKit.
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ desktop-class Safari
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

interface ImportCardProps {
  eyebrowIcon: IconName;
  eyebrow: string;
  hint: string;
  error?: string | null;
  action: ReactNode;
  children: ReactNode;
}

/**
 * Card shell shared by both import paths. Layout follows the kit:
 * eyebrow with small tomato icon on top, the input/textarea below,
 * an inline error if any, a faint hint, then the primary action
 * sits at the bottom-left — never inline with the input field.
 */
function ImportCard({
  eyebrowIcon,
  eyebrow,
  hint,
  error,
  action,
  children,
}: ImportCardProps) {
  return (
    <section className="bg-white rounded-lg px-6 py-5 shadow-sm border border-[var(--border-faint)] flex flex-col gap-3">
      <Eyebrow className="flex items-center gap-1.5 text-tomato-600">
        <Icon name={eyebrowIcon} size={12} />
        {eyebrow}
      </Eyebrow>
      {children}
      {error && (
        <p className="font-sans text-[13px] text-tomato-700 m-0">{error}</p>
      )}
      <p className="font-sans text-xs text-ink-500 m-0 leading-[1.5]">
        {hint}
      </p>
      <div className="mt-1">{action}</div>
    </section>
  );
}
