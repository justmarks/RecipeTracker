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
import { prepareImageForImport } from "../lib/importImage";
import { consumeSharedFile } from "../lib/shareTarget";
import { RecipeForm } from "../components/RecipeForm";
import { Button, Eyebrow, Icon, Input, Textarea } from "../components/ui";
import type { IconName } from "../components/ui";
import type { ReactNode } from "react";

type ImportFromUrlResponse = { recipe: Partial<RecipeInput> };
type ImportFromImageResponse = { recipe: Partial<RecipeInput> };

const callImportFromUrl = httpsCallable<{ url: string }, ImportFromUrlResponse>(
  functions,
  "importFromUrl",
);

const callImportFromImage = httpsCallable<
  { imageBase64: string; mimeType: string },
  ImportFromImageResponse
>(functions, "importFromImage");

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
  // Set by the service-worker share-target handler when the system share
  // sheet handed us a photo (Android only — see CLAUDE.md re: iOS).
  const sharedPhotoPending = params.get("via") === "share-photo";

  const [urlInput, setUrlInput] = useState(sharedUrl);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [autoFetched, setAutoFetched] = useState(false);

  const [markdownText, setMarkdownText] = useState("");
  const [parsed, setParsed] = useState<Partial<RecipeInput> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [autoPhoto, setAutoPhoto] = useState(false);
  // Drag-hover state for the photo drop-zone — toggled on dragenter /
  // dragleave so the visual treatment changes only while a drag is
  // actively over the zone.
  const [photoDragOver, setPhotoDragOver] = useState(false);

  const mdFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const autoFetchRef = useRef(false);
  const autoPhotoRef = useRef(false);

  // Share-target landings: if the manifest's share_target handed us a
  // URL (via ?url= or ?text= containing an http(s) link), skip the
  // "click Fetch" step entirely. Auto-fire the import once on mount and
  // show a progress screen while Claude works.
  useEffect(() => {
    if (autoFetchRef.current) return;
    if (!user) return;
    if (!sharedUrl || !/^https?:\/\//i.test(sharedUrl)) return;
    autoFetchRef.current = true;
    setUrlInput(sharedUrl);
    setAutoFetched(true);
    void fetchUrl(sharedUrl);
    // fetchUrl is stable for this render — guarded by autoFetchRef so it
    // only runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl, user]);

  // Photo share-target landings (Android): the service worker stashed
  // the shared file in CacheStorage and redirected us here with
  // ?via=share-photo. Pull the file back out and kick off vision import.
  useEffect(() => {
    if (autoPhotoRef.current) return;
    if (!user) return;
    if (!sharedPhotoPending) return;
    autoPhotoRef.current = true;
    setAutoPhoto(true);
    void (async () => {
      const file = await consumeSharedFile();
      if (!file) {
        setPhotoError(
          "Couldn't find the shared photo. The service worker may not have finished registering yet — try sharing again.",
        );
        setAutoPhoto(false);
        return;
      }
      await processPhoto(file);
    })();
    // processPhoto is stable for this render — guarded by autoPhotoRef
    // so it only runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPhotoPending, user]);

  // When share-target supplied a URL and we haven't parsed yet, keep the
  // page focused on the URL fetcher — the user came here intending to
  // import that URL, not to paste markdown.
  const showOnlyUrlFetcher = useMemo(
    () => Boolean(sharedUrl && /^https?:\/\//i.test(sharedUrl)) && !parsed,
    [sharedUrl, parsed],
  );
  // Same idea for photo share — keep the page focused on the photo flow
  // while the import is in flight.
  const showOnlyPhotoFetcher = useMemo(
    () => sharedPhotoPending && !parsed,
    [sharedPhotoPending, parsed],
  );

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function fetchUrl(url: string) {
    setUrlError(null);
    setFetchingUrl(true);
    try {
      const result = await callImportFromUrl({ url });
      setParsed(result.data.recipe);
    } catch (err) {
      console.error("importFromUrl:", err);
      const message = err instanceof Error ? err.message : String(err);
      setUrlError(message);
      // Auto-fetch failed — drop back to the manual screen so the user
      // can edit the URL and retry. The error renders inline on the card.
      setAutoFetched(false);
    } finally {
      setFetchingUrl(false);
    }
  }

  async function handleFetchUrl() {
    const url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      setUrlError("Enter a valid http(s) URL.");
      return;
    }
    await fetchUrl(url);
  }

  /**
   * Common pipeline for any photo source — file picker, camera capture,
   * or share-target hand-off. Resize → base64 → Cloud Function vision
   * call → drop into the review form.
   */
  async function processPhoto(file: File) {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const prepared = await prepareImageForImport(file);
      const result = await callImportFromImage({
        imageBase64: prepared.base64,
        mimeType: prepared.mimeType,
      });
      setParsed(result.data.recipe);
    } catch (err) {
      console.error("importFromImage:", err);
      setPhotoError(err instanceof Error ? err.message : String(err));
      // Share-target auto path drops back to manual photo UI on error.
      setAutoPhoto(false);
    } finally {
      setPhotoBusy(false);
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

  const showUrlProgress = autoFetched && fetchingUrl && !parsed;
  const showPhotoProgress = autoPhoto && photoBusy && !parsed;

  return (
    <div className="mx-auto max-w-[640px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={() => navigate("/")}
        className="px-0 mb-4"
      >
        Back
      </Button>

      {showUrlProgress ? (
        <ImportProgress
          label="Importing recipe…"
          detail={
            <>
              Asking Claude to read{" "}
              <span className="font-medium text-ink-700">{urlHost(urlInput)}</span>{" "}
              and pull out the recipe.
            </>
          }
        />
      ) : showPhotoProgress ? (
        <ImportProgress
          label="Reading photo…"
          detail="Asking Claude to read the photo and pull out the recipe."
        />
      ) : parsed ? (
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
                eyebrowIcon="image"
                eyebrow="Extract w/AI from photo"
                hint="JPEG, PNG, WebP, or GIF — up to about 5 MB after the in-app resize."
                error={photoError}
                action={
                  <Button
                    type="button"
                    variant="primary"
                    icon="upload"
                    onClick={() => photoFileRef.current?.click()}
                    disabled={photoBusy}
                  >
                    {photoBusy ? "Reading…" : "Choose photo"}
                  </Button>
                }
              >
                {/*
                  Clickable drop-zone — primary visual affordance per the
                  design-system spec. Clicking anywhere on the zone opens
                  the same file picker the button does; dragging a file
                  over it gives a hover treatment, and dropping kicks off
                  the same processPhoto pipeline. The button below is the
                  always-discoverable fallback for browsers / inputs that
                  don't surface drag-and-drop (touch devices, screen
                  readers).
                */}
                <button
                  type="button"
                  onClick={() => photoFileRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setPhotoDragOver(true);
                  }}
                  onDragOver={(e) => {
                    // Required to allow drop — without preventDefault the
                    // drop event never fires.
                    e.preventDefault();
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setPhotoDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setPhotoDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void processPhoto(file);
                  }}
                  disabled={photoBusy}
                  className={[
                    "flex flex-col items-center justify-center gap-2 w-full",
                    "px-6 py-8 rounded-md",
                    "border-[1.5px] border-dashed",
                    "transition-colors duration-100",
                    photoDragOver
                      ? "border-tomato-500 bg-tomato-50 text-tomato-700"
                      : "border-paper-400 bg-paper-50 text-ink-500 hover:border-paper-400 hover:bg-paper-100",
                    photoBusy ? "cursor-default opacity-60" : "cursor-pointer",
                  ].join(" ")}
                  aria-label="Drag a photo here or click to choose one"
                >
                  <Icon name="image" size={28} />
                  <span className="font-sans text-[13px]">
                    Snap a cookbook page, magazine clipping, or recipe card —
                    drag here, or use the button below
                  </span>
                </button>
                <input
                  ref={photoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  // On mobile this prefers the rear camera and opens it
                  // directly; desktop browsers ignore the attribute and
                  // fall back to a normal file picker.
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void processPhoto(file);
                    if (photoFileRef.current) {
                      photoFileRef.current.value = "";
                    }
                  }}
                  className="hidden"
                />
              </ImportCard>
            )}

            {!showOnlyUrlFetcher && !showOnlyPhotoFetcher && (
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

/**
 * Full-screen progress state for share-target imports. Replaces the
 * import options entirely while Claude fetches and parses the source,
 * so the user never has to tap "Fetch" — they just see progress and
 * land in the review form when it resolves.
 *
 * Same component is reused for URL and photo share targets; the caller
 * supplies the wording and any details inline.
 */
function ImportProgress({
  label,
  detail,
}: {
  label: string;
  detail: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <span className="mb-5 text-tomato-500 animate-spin">
        <Icon name="sparkles" size={32} />
      </span>
      <h1 className="font-display text-[28px] sm:text-[32px] font-medium leading-[1.15] tracking-[-0.015em] text-ink-900 m-0 mb-2">
        {label}
      </h1>
      <p className="font-sans text-sm text-ink-500 m-0 max-w-[36ch]">
        {detail}
      </p>
    </div>
  );
}

/** Pretty-print the hostname for the URL progress label. */
function urlHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
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
