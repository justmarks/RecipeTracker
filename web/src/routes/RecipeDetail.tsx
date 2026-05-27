import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useToast } from "../lib/useToast";
import { renderInlineMarkdown, renderMarkdownBlock } from "../lib/inlineMarkdown";
import type { RecipeSource, Section } from "shared";
import {
  Button,
  ConfirmDialog,
  Eyebrow,
  Icon,
  MetaRow,
  SprigDivider,
  Tag,
  tagToneFor,
} from "../components/ui";

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
};

/**
 * Recipe detail — the editorial payoff. Newsreader title + italic numbered
 * steps, tomato-dot ingredient bullets, sprig dividers between sections,
 * saffron notes card. Print-style cookbook on screen.
 *
 * Layout follows the kit:
 *   ← Back
 *   CATEGORY eyebrow
 *   Title (44px Newsreader) · Edit button
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
  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    getDoc(doc(db, "recipes", id))
      .then((snap) => {
        if (snap.exists()) {
          setRecipe(snap.data() as DocumentData as StoredRecipe);
        } else {
          setError("Recipe not found.");
        }
      })
      .catch((err) => {
        console.error("Load recipe:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [user, id]);

  function goBack() {
    // Prefer the previous in-app page (e.g. filtered list) over a forced
    // jump to home. window.history.length > 1 means there's something to
    // pop; deep links / first page fall through to home.
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
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

  return (
    <article className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={goBack}
        className="px-0 mb-4"
      >
        Back
      </Button>

      <Eyebrow>{recipe.category}</Eyebrow>

      <div className="mt-1.5 flex items-start justify-between gap-4">
        <h1 className="font-display text-[32px] sm:text-[44px] font-medium leading-[1.05] tracking-[-0.02em] text-ink-900 m-0 flex-1 min-w-0">
          {recipe.title}
        </h1>
        {isOwner && (
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/recipes/${id}/edit`} className="no-underline">
              <Button variant="secondary" icon="pencil" size="sm" type="button">
                Edit
              </Button>
            </Link>
            <Button
              type="button"
              variant="danger"
              icon="trash"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {recipe.tags.map((t) => (
            <Tag key={t} tone={tagToneFor(t)}>
              {t}
            </Tag>
          ))}
        </div>
      )}

      {recipe.source && (
        <p className="mt-4 font-sans text-[13px] text-ink-500 m-0">
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

      {recipe.photoUrl && (
        <img
          src={recipe.photoUrl}
          alt=""
          loading="lazy"
          className="mt-6 w-full max-h-[420px] rounded-lg object-cover border border-paper-300 shadow-sm"
        />
      )}

      {metaItems.length > 0 && (
        <div className="mt-6 px-5 py-4 bg-paper-50 rounded-lg border border-[var(--border-faint)]">
          <MetaRow items={metaItems} />
        </div>
      )}

      {(recipe.rating || recipe.lastMadeDate) && (
        <div className="mt-4 flex items-center gap-3 text-xs text-ink-500 font-sans">
          {recipe.rating && (
            <span aria-label={`Rated ${recipe.rating} out of 5`}>
              <span className="text-saffron-500">{"★".repeat(recipe.rating)}</span>
              <span className="text-ink-300">{"★".repeat(5 - recipe.rating)}</span>
            </span>
          )}
          {recipe.rating && recipe.lastMadeDate && (
            <span className="text-ink-300">·</span>
          )}
          {recipe.lastMadeDate && (
            <span>Last made {formatDate(recipe.lastMadeDate)}</span>
          )}
        </div>
      )}

      <SprigDivider />

      <section>
        <h2 className="font-display text-[24px] font-medium text-ink-900 m-0 mb-3.5">
          Ingredients
        </h2>
        {recipe.ingredients.map((sec, i) => (
          <div key={i} className="mb-4 last:mb-0">
            {sec.heading && (
              <Eyebrow className="mb-1.5 text-tomato-600">
                {sec.heading}
              </Eyebrow>
            )}
            <ul className="list-none p-0 m-0 font-sans text-[15px] leading-[1.7] text-ink-700">
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
        <h2 className="font-display text-[24px] font-medium text-ink-900 m-0 mb-3.5">
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
                  className="flex gap-4 mb-3.5 last:mb-0 font-sans text-[17px] leading-[1.65] text-ink-900"
                >
                  <span className="shrink-0 basis-7 font-display italic font-normal text-[22px] text-tomato-500 leading-[1.4]">
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
            <h2 className="font-display text-[24px] font-medium text-ink-900 m-0 mb-3.5">
              Notes
            </h2>
            <div className="px-5 py-4 bg-saffron-100 rounded-lg border-l-[3px] border-saffron-500 font-display italic text-[18px] leading-[1.55] text-ink-700">
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
