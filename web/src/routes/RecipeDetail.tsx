import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useFavorites } from "../lib/favorites";
import { useTagPalette } from "../lib/tags";
import { useToast } from "../lib/useToast";
import { renderInlineMarkdown, renderMarkdownBlock } from "../lib/inlineMarkdown";
import type { RecipeSource, Section } from "shared";
import {
  Button,
  ConfirmDialog,
  Eyebrow,
  Icon,
  MetaRow,
  PhotoFrame,
  SprigDivider,
  StarRating,
  Tag,
  tagToneFor,
} from "../components/ui";
import { ShareDialog } from "../components/ShareDialog";

type SharedWithDetail = { uid: string; email: string };

type StoredRecipe = {
  ownerId: string;
  title: string;
  source?: RecipeSource;
  ingredients: Section[];
  instructions: Section[];
  notes?: string;
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  category: string;
  tags: string[];
  photoUrl?: string;
  rating?: number;
  lastMadeDate?: string;
  sharedWith?: string[];
  sharedWithDetails?: SharedWithDetail[];
};

/**
 * Recipe detail — the editorial payoff. Newsreader title + italic numbered
 * steps, tomato-dot ingredient bullets, sprig dividers between sections,
 * saffron notes card. Print-style cookbook on screen.
 *
 * Layout follows the kit:
 *   ← Back · Edit · Share · Delete (action buttons share the back row)
 *   CATEGORY eyebrow
 *   Title (44px Newsreader, full width)
 *   Tag chips
 *   Source line
 *   (photo)
 *   Meta box (yield / prep / cook / total)
 *   Rating + last-made row
 *   sprig
 *   Ingredients (tomato dots, sub-section eyebrows in tomato-600)
 *   sprig
 *   Instructions (italic Newsreader numbers in tomato)
 *   sprig + Notes (saffron card)
 */
export function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { favorites, toggle: toggleFavorite } = useFavorites(user?.uid);
  const { palette: tagPalette } = useTagPalette(user?.uid);
  const isFavorited = id ? favorites.has(id) : false;
  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    // Live subscription instead of one-shot getDoc so the page
    // reflects edits the moment they save (especially important when
    // the edit flow's "save → navigate(-1)" lands the user back on
    // a still-mounted RecipeDetail — without a live listener the
    // displayed data would be stale until the next manual reload).
    const unsub = onSnapshot(
      doc(db, "recipes", id),
      (snap) => {
        if (snap.exists()) {
          setRecipe(snap.data() as DocumentData as StoredRecipe);
          setError(null);
        } else {
          setError("Recipe not found.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Load recipe:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      },
    );
    return unsub;
  }, [user, id]);

  function goBack() {
    // Prefer the previous in-app page (e.g. filtered list) over a forced
    // jump to home. window.history.length > 1 means there's something to
    // pop; deep links / first page fall through to home.
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  /**
   * Export the current recipe as a PDF via the browser's native print
   * → "Save as PDF" flow. Zero deps, preserves Newsreader typography,
   * and works on every platform (iOS Safari included — though iOS's
   * Print → pinch-to-PDF → Share dance is clunkier than desktop).
   *
   * We swap `document.title` temporarily so the default saved
   * filename is "Roasted Tomato Soup.pdf" instead of "MarksRecipeBook.pdf".
   * Filename-illegal characters are stripped because some OSes will
   * silently refuse the save otherwise.
   */
  function handlePrint() {
    if (!recipe) return;
    const previousTitle = document.title;
    document.title = (recipe.title || "Recipe").replace(/[\\/:*?"<>|]/g, " ").trim();
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  async function handleDelete() {
    if (!id || !recipe) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "recipes", id));
      setShowDeleteConfirm(false);
      toast.show(`Deleted "${recipe.title}"`);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Delete recipe:", err);
      setError(err instanceof Error ? err.message : "Could not delete recipe.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (error) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
        <Button variant="ghost" icon="arrow-left" onClick={goBack} className="px-0">
          Back
        </Button>
        <p className="mt-6 font-sans text-tomato-700">{error}</p>
      </div>
    );
  }
  if (!recipe) return null;

  const isOwner = recipe.ownerId === user.uid;
  const metaItems = [
    recipe.yield && { label: "Yield", value: recipe.yield },
    recipe.prepTime && { label: "Prep", value: recipe.prepTime },
    recipe.cookTime && { label: "Cook", value: recipe.cookTime },
    recipe.totalTime && { label: "Total", value: recipe.totalTime },
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  // Favorite + PDF are personal actions, available to everyone who can
  // view the recipe (owners and people it's shared with). Edit / Share /
  // Delete are owner-only.
  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      {id && (
        <Button
          type="button"
          variant="secondary"
          icon="heart"
          iconFilled={isFavorited}
          size="sm"
          onClick={() => {
            void toggleFavorite(id).catch((err) => {
              toast.show(
                err instanceof Error
                  ? `Couldn't update favorite: ${err.message}`
                  : "Couldn't update favorite.",
              );
            });
          }}
          aria-pressed={isFavorited}
          aria-label={isFavorited ? "Favorited" : "Favorite"}
          className={isFavorited ? "text-tomato-600" : undefined}
        >
          <span className="hidden sm:inline">
            {isFavorited ? "Favorited" : "Favorite"}
          </span>
        </Button>
      )}
      {isOwner && (
        <Link to={`/recipes/${id}/edit`} className="no-underline">
          <Button variant="secondary" icon="pencil" size="sm" type="button" aria-label="Edit">
            <span className="hidden sm:inline">Edit</span>
          </Button>
        </Link>
      )}
      {isOwner && (
        <Button
          type="button"
          variant="secondary"
          icon="share-2"
          size="sm"
          onClick={() => setShareOpen(true)}
          aria-label="Share"
        >
          <span className="hidden sm:inline">Share</span>
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        icon="download"
        size="sm"
        onClick={handlePrint}
        aria-label="PDF"
      >
        <span className="hidden sm:inline">PDF</span>
      </Button>
      {isOwner && (
        <Button
          type="button"
          variant="danger"
          icon="trash"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete"
        >
          <span className="hidden sm:inline">Delete</span>
        </Button>
      )}
    </div>
  );

  return (
    <article className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <Button
          variant="ghost"
          icon="arrow-left"
          onClick={goBack}
          className="px-0"
        >
          Back
        </Button>
        {actionButtons}
      </div>

      {/*
        Hero photo — full-bleed at the top per the design system's
        recipe-detail spec. Negative horizontal margins escape the
        article's px-6 mobile padding so the photo runs edge-to-edge;
        at lg+ it sits inside the 720px content column with a 20px
        radius and a paper-300 hairline.
        Only rendered when the recipe has a photo. The system spec
        says to always show the slot with an empty-state placeholder,
        but at 3:2 of a 720px column that's ~480px of dead space for
        the many text-only recipes in this library — a worse default
        than just hiding the slot. The Eyebrow + title still sit at
        the top of the article when no photo exists.
      */}
      {recipe.photoUrl && (
        <PhotoFrame
          src={recipe.photoUrl}
          alt={recipe.title}
          ratio="3 / 2"
          radius="none"
          border={false}
          className="-mx-6 lg:mx-0 mb-6 lg:rounded-[20px] lg:border lg:border-paper-300 print:hidden"
        />
      )}

      <Eyebrow>{recipe.category}</Eyebrow>

      <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.02em] text-ink-900 m-0">
        {recipe.title}
      </h1>

      {/*
        Rating + last-made sits ABOVE tags per the design system update —
        these are the user's personal relationship to the recipe (how
        they rated it, when they last cooked it) and earn the prime
        slot just under the title. Tags are recipe-descriptive metadata
        and drop one slot down the visual hierarchy.
      */}
      {(recipe.rating || recipe.lastMadeDate) && (
        <div className="mt-4 flex items-center gap-3 font-sans text-ink-500">
          {recipe.rating && <StarRating value={recipe.rating} size={18} />}
          {recipe.rating && recipe.lastMadeDate && (
            <span aria-hidden="true" className="text-ink-300">
              ·
            </span>
          )}
          {recipe.lastMadeDate && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Icon name="clock" size={14} />
              Last made {formatDate(recipe.lastMadeDate)}
            </span>
          )}
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {recipe.tags.map((t) => (
            <Tag key={t} tone={tagToneFor(t, tagPalette)}>
              {t}
            </Tag>
          ))}
        </div>
      )}

      {recipe.source && (
        <p className="mt-4 font-sans text-sm text-ink-500 m-0">
          {recipe.source.type === "url" ? (
            <SourceUrlLink url={recipe.source.url} />
          ) : (
            <span>
              From{" "}
              <em className="font-display not-italic font-medium text-ink-700">
                {recipe.source.title}
              </em>
              {recipe.source.author && ` by ${recipe.source.author}`}
              {recipe.source.page && `, p. ${recipe.source.page}`}
            </span>
          )}
        </p>
      )}

      {metaItems.length > 0 && (
        <div className="mt-6 px-5 py-4 bg-paper-50 rounded-lg border border-[var(--border-faint)]">
          <MetaRow items={metaItems} />
        </div>
      )}

      <SprigDivider />

      <section>
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3.5">
          Ingredients
        </h2>
        {recipe.ingredients.map((sec, i) => (
          <div key={i} className="mb-4 last:mb-0">
            {sec.heading && (
              <Eyebrow className="mb-1.5 text-tomato-600">
                {sec.heading}
              </Eyebrow>
            )}
            <ul className="list-none p-0 m-0 font-sans text-base leading-[1.7] text-ink-700">
              {sec.items.map((it, j) => (
                <li key={j} className="relative pl-5">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-[0.65em] w-1.5 h-1.5 bg-tomato-500 rounded-full"
                  />
                  {renderInlineMarkdown(it)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <SprigDivider />

      <section>
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3.5">
          Instructions
        </h2>
        {recipe.instructions.map((sec, i) => (
          <div key={i} className="mb-5 last:mb-0">
            {sec.heading && (
              <Eyebrow className="mb-2 text-tomato-600">{sec.heading}</Eyebrow>
            )}
            <ol className="list-none p-0 m-0">
              {sec.items.map((it, j) => (
                <li
                  key={j}
                  className="flex gap-4 mb-3.5 last:mb-0 font-sans text-md leading-[1.65] text-ink-900"
                >
                  <span className="shrink-0 basis-7 font-display italic font-normal text-xl text-tomato-500 leading-[1.4]">
                    {j + 1}.
                  </span>
                  <span className="flex-1 min-w-0">
                    {renderInlineMarkdown(it)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {recipe.notes && (
        <>
          <SprigDivider />
          <section>
            <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3.5">
              Notes
            </h2>
            <div className="px-5 py-4 bg-saffron-100 rounded-lg border-l-[3px] border-saffron-500 font-display italic text-md leading-[1.55] text-ink-700">
              {renderMarkdownBlock(recipe.notes)}
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this recipe?"
        message={`"${recipe.title}" will be permanently removed from your cookbook. This can't be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel="Keep"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />

      {isOwner && id && (
        <ShareDialog
          open={shareOpen}
          recipeId={id}
          recipeTitle={recipe.title}
          sharedWithDetails={recipe.sharedWithDetails ?? []}
          onClose={() => setShareOpen(false)}
          onChange={(next) =>
            // Optimistically reflect changes from the dialog locally.
            // The Firestore doc has the source of truth; next refresh
            // will reconcile if anything went sideways.
            setRecipe((prev) =>
              prev
                ? {
                    ...prev,
                    sharedWithDetails: next,
                    sharedWith: next.map((d) => d.uid),
                  }
                : prev,
            )
          }
        />
      )}
    </article>
  );
}

/**
 * Render a source URL as a link with a link icon and just the hostname
 * (sans `www.`). Falls back to raw URL text if parsing fails — a
 * malformed stored URL shouldn't crash the page.
 */
function SourceUrlLink({ url }: { url: string }) {
  let label = url;
  try {
    label = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw URL as label
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-baseline gap-1 text-tomato-600 hover:text-tomato-700 no-underline hover:underline"
    >
      <Icon name="link" size={12} className="self-center" />
      {label}
    </a>
  );
}

/**
 * Format an ISO YYYY-MM-DD as "May 27, 2026" in the user's locale.
 * Manual local-timezone parsing avoids the off-by-one when a UTC
 * midnight string is rendered in a negative-UTC timezone.
 */
function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
