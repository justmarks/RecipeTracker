import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../lib/useAuth";
import { useChapters } from "../lib/categories";
import { useFavorites } from "../lib/favorites";
import { useRecipeList } from "../lib/queryRecipes";
import type { RecipeListItem } from "../lib/queryRecipes";
import { useToast } from "../lib/useToast";
import {
  Button,
  Eyebrow,
  Icon,
  PhotoFrame,
  Select,
  SprigDivider,
  Tag,
  tagToneFor,
} from "../components/ui";

type RecipeSummary = RecipeListItem;

type SortOrder = "alpha" | "recent";

/**
 * Recipe list — the cookbook index. The sidebar owns brand + actions;
 * this page is content only. When `?chapter=<name>` is present the
 * list scopes to that chapter and the page title swaps to it.
 *
 * Layout follows the kit's RecipeListView:
 *   COOKBOOK eyebrow
 *   38px Newsreader title  ·  optional "Show all" link
 *   Search field (icon embedded) + sort selector
 *   Chapter sections — bottom-bordered Newsreader h2 + count
 *   Recipe rows — Newsreader title + mono time + tags + chevron
 */
export function Home() {
  const { user } = useAuth();
  const { chapters } = useChapters(user?.uid);
  const { favorites, toggle: toggleFavorite } = useFavorites(user?.uid);
  const toast = useToast();
  const [params] = useSearchParams();
  const activeChapter = params.get("chapter") ?? "";
  const favoritesOnly = params.get("favorites") === "1";
  const otherOnly = params.get("view") === "other";

  // Merged stream of recipes I own + recipes explicitly shared with me +
  // recipes auto-shared with me. The hook handles the three-way fan-out.
  const { recipes } = useRecipeList(user?.uid);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("alpha");

  // Which sections are expanded on the full TOC view.
  // "recent" and "favorites" start open; all chapters start collapsed.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["recent", "favorites"]),
  );

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // When the user navigates back from a chapter-filtered view to the full
  // TOC (e.g. clicks "Show all"), auto-open that chapter's section so
  // they land somewhere meaningful.
  const prevChapterRef = useRef(activeChapter);
  useEffect(() => {
    const prev = prevChapterRef.current;
    prevChapterRef.current = activeChapter;
    if (!activeChapter && prev) {
      setExpandedSections((s) => new Set([...s, prev.toLowerCase()]));
    }
  }, [activeChapter]);

  const queryTokens = useMemo(
    () =>
      search
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    [search],
  );

  // 1. favorites / other filter → 2. chapter scope → 3. search (AND-
  //    prefix match across tokens + tags + category). Favorites, Other,
  //    and chapter scope are mutually exclusive in the sidebar UI, but
  //    the pipeline composes either way.
  const filtered = useMemo(() => {
    let arr = recipes;
    if (favoritesOnly) {
      arr = arr.filter((r) => favorites.has(r.id));
    }
    if (otherOnly) {
      // "Other" = recipes with a category that isn't in the user's
      // chapter list (orphans). Compare case-insensitively to match
      // how Sidebar.tsx and the chapter-section grouping bucket them.
      const chapterKeys = new Set(chapters.map((c) => c.toLowerCase()));
      arr = arr.filter((r) => !chapterKeys.has(r.category.toLowerCase()));
    }
    if (activeChapter) {
      const want = activeChapter.toLowerCase();
      arr = arr.filter((r) => r.category.toLowerCase() === want);
    }
    if (queryTokens.length > 0) {
      arr = arr.filter((r) => {
        const haystack = [...r.searchTokens, ...r.tags, r.category].map((h) =>
          h.toLowerCase(),
        );
        return queryTokens.every((q) => haystack.some((h) => h.startsWith(q)));
      });
    }
    return arr;
  }, [
    recipes,
    queryTokens,
    activeChapter,
    favoritesOnly,
    otherOnly,
    favorites,
    chapters,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortOrder === "alpha") {
      arr.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    } else {
      arr.sort(
        (a, b) =>
          (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
      );
    }
    return arr;
  }, [filtered, sortOrder]);

  // Group by chapter for the unfiltered TOC view. When a single chapter
  // is active, sections collapse — we render one flat list instead.
  const byChapter = useMemo(() => {
    const groups = new Map<string, RecipeSummary[]>();
    for (const c of chapters) groups.set(c.toLowerCase(), []);
    const orphans: RecipeSummary[] = [];
    for (const r of sorted) {
      const bucket = groups.get(r.category.toLowerCase());
      if (bucket) bucket.push(r);
      else orphans.push(r);
    }
    return { groups, orphans };
  }, [sorted, chapters]);

  const searching = queryTokens.length > 0;
  const matchCount = filtered.length;

  return (
    <div className="mx-auto max-w-[880px] px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-6">
        <Eyebrow>Cookbook</Eyebrow>
        <div className="mt-1 flex items-end justify-between gap-3 sm:gap-5">
          <h1 className="font-display text-[28px] sm:text-[38px] font-medium leading-[1.1] tracking-[-0.015em] text-ink-900 m-0 capitalize truncate min-w-0 flex-1">
            {favoritesOnly
              ? "Favorites"
              : otherOnly
                ? "Other"
                : activeChapter || "All recipes"}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {(activeChapter || favoritesOnly || otherOnly) && (
              <Link
                to="/"
                className="hidden sm:inline text-sm text-tomato-600 hover:text-tomato-700 no-underline whitespace-nowrap mr-1"
              >
                Show all
              </Link>
            )}
            <Link to="/import" className="no-underline" aria-label="Import a recipe">
              <Button variant="secondary" icon="sparkles" size="sm">
                <span className="hidden sm:inline">Import</span>
              </Button>
            </Link>
            <Link to="/recipes/new" className="no-underline" aria-label="New recipe">
              <Button variant="primary" icon="plus" size="sm">
                <span className="hidden sm:inline">New recipe</span>
              </Button>
            </Link>
          </div>
        </div>
        {(activeChapter || favoritesOnly || otherOnly) && (
          <Link
            to="/"
            className="sm:hidden mt-2 inline-block text-sm text-tomato-600 hover:text-tomato-700 no-underline"
          >
            ← Show all chapters
          </Link>
        )}
      </header>

      {recipes.length > 0 && (
        <div className="mb-8 flex items-start gap-3">
          <div className="relative flex-1">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
              aria-hidden="true"
            >
              <Icon name="search" size={16} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or ingredient…"
              className="w-full font-sans text-sm text-ink-900 bg-white border border-paper-400 rounded-md pl-10 pr-9 py-2.5 outline-none transition-colors duration-100 focus:border-tomato-500 focus:shadow-[var(--shadow-focus)] placeholder:text-ink-300"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900 p-1"
                aria-label="Clear search"
              >
                <Icon name="x" size={14} />
              </button>
            )}
            {searching && (
              <p className="mt-1 text-xs text-ink-500">
                {matchCount} match{matchCount === 1 ? "" : "es"}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <Select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              aria-label="Sort order"
            >
              <option value="alpha">A → Z</option>
              <option value="recent">Recent first</option>
            </Select>
          </div>
        </div>
      )}

      <FavoriteContext.Provider
        value={{
          favorites,
          onToggle: (recipeId) => {
            void toggleFavorite(recipeId).catch((err) => {
              toast.show(
                err instanceof Error
                  ? `Couldn't update favorite: ${err.message}`
                  : "Couldn't update favorite.",
              );
            });
          },
        }}
      >
        {recipes.length === 0 ? (
          <EmptyState />
        ) : searching && matchCount === 0 ? (
          <p className="font-sans text-sm text-ink-700 text-center py-12">
            No recipes match &ldquo;{search}&rdquo;.
          </p>
        ) : favoritesOnly ? (
          sorted.length === 0 ? (
            <FavoritesEmptyState />
          ) : (
            // Favorites view is always alphabetical — the sortOrder
            // selector still appears (it would be jarring to hide it),
            // but in favorites mode the alpha ordering is canonical.
            <RecipeList
              recipes={[...sorted].sort((a, b) =>
                a.title.localeCompare(b.title, undefined, {
                  sensitivity: "base",
                }),
              )}
            />
          )
        ) : otherOnly ? (
          <RecipeList recipes={sorted} />
        ) : activeChapter ? (
          <RecipeList recipes={sorted} />
        ) : (
          <>
            <RecentlyAdded
              recipes={recipes}
              isOpen={expandedSections.has("recent")}
              onToggle={() => toggleSection("recent")}
            />
            {/* Favorites section is hidden during search because it
                shows the user's full favorites list (not search-filtered)
                — leaving it visible during search would surface recipes
                that don't match what the user just typed. The chapter
                sections below are search-aware (they render `sorted`,
                which already has the query filter applied) so they're
                fine to show. */}
            {!searching && (
              <FavoritesSection
                recipes={recipes
                  .filter((r) => favorites.has(r.id))
                  .sort((a, b) =>
                    a.title.localeCompare(b.title, undefined, {
                      sensitivity: "base",
                    }),
                  )}
                isOpen={expandedSections.has("favorites")}
                onToggle={() => toggleSection("favorites")}
              />
            )}
            <div className="flex flex-col gap-0">
              {chapters.map((chapter) => {
                const items =
                  byChapter.groups.get(chapter.toLowerCase()) ?? [];
                if (items.length === 0) return null;
                return (
                  <ChapterSection
                    key={chapter}
                    name={chapter}
                    recipes={items}
                    // Force-open during search so matches are visible
                    // without the user having to click into each chapter
                    // that survived the filter. The user's manual
                    // expansion state is preserved — collapses back to
                    // whatever they had when the search clears.
                    isOpen={
                      searching ||
                      expandedSections.has(chapter.toLowerCase())
                    }
                    onToggle={() => toggleSection(chapter.toLowerCase())}
                  />
                );
              })}
              {byChapter.orphans.length > 0 && (
                <ChapterSection
                  name="Other"
                  recipes={byChapter.orphans}
                  italic
                  isOpen={searching || expandedSections.has("other")}
                  onToggle={() => toggleSection("other")}
                />
              )}
            </div>
          </>
        )}
      </FavoriteContext.Provider>
    </div>
  );
}

/**
 * Context that makes `favorites` membership + the toggle handler
 * available to deeply-nested `RecipeRow`s without prop-drilling
 * through `RecipeList` and `ChapterSection`. Only valid inside the
 * Home tree — outside, the heart button is hidden by default.
 */
const FavoriteContext = createContext<{
  favorites: Set<string>;
  onToggle: (recipeId: string) => void;
} | null>(null);

/** Animated expand/collapse container using grid-template-rows trick. */
function CollapsePanel({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        transition: "grid-template-rows 200ms ease",
      }}
      aria-hidden={!isOpen}
    >
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/**
 * Favorites section — sits between "Recently added" and the chapter
 * sections on the unscoped Home view. Hidden when the user hasn't
 * favorited anything yet, so a new user doesn't see an empty section
 * before they've discovered the feature.
 */
function FavoritesSection({
  recipes,
  isOpen,
  onToggle,
}: {
  recipes: RecipeSummary[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (recipes.length === 0) return null;
  return (
    <section className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2.5 border-b border-paper-300 pb-2 mb-0 text-left cursor-pointer hover:text-tomato-600 transition-colors duration-100 group"
      >
        <Icon name="heart" size={18} filled className="text-tomato-500 shrink-0" />
        <span className="font-display text-[22px] font-medium text-ink-900 group-hover:text-tomato-600 transition-colors duration-100">
          Favorites
        </span>
        <span className="font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
          {recipes.length}
        </span>
        <span className="ml-auto shrink-0 text-ink-400 group-hover:text-tomato-600 transition-colors duration-100">
          <Icon
            name="chevron-right"
            size={16}
            className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      <CollapsePanel isOpen={isOpen}>
        <div className="pt-3 mb-8">
          <RecipeList recipes={recipes} />
        </div>
      </CollapsePanel>
    </section>
  );
}

function FavoritesEmptyState() {
  return (
    <div className="text-center py-16">
      <SprigDivider className="opacity-50 mb-4" />
      <p className="font-display italic text-[22px] text-ink-700 m-0">
        No favorites yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-2 max-w-[360px] mx-auto">
        Tap the heart on any recipe to keep it within easy reach here.
      </p>
    </div>
  );
}

/**
 * "Recently added" card grid — the kit's discovery affordance for the
 * cookbook root. Top 4 recipes by createdAt across all sources (owned +
 * shared + auto-shared) rendered as 4:3 photo cards. Only shown on the
 * unscoped, unsearched view; when a chapter is active or the user is
 * searching, the grid would just be noise.
 *
 * Threshold: 5+ recipes. Below that, the cards would duplicate every
 * row in the chapter sections below, which feels redundant rather than
 * useful.
 */
function RecentlyAdded({
  recipes,
  isOpen,
  onToggle,
}: {
  recipes: RecipeSummary[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const featured = useMemo(() => {
    if (recipes.length < 5) return [];
    return [...recipes]
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
      )
      .slice(0, 4);
  }, [recipes]);

  if (featured.length === 0) return null;

  return (
    <section className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2.5 pb-2 mb-0 text-left cursor-pointer group"
      >
        <span className="font-display italic text-[22px] font-medium text-ink-900 group-hover:text-tomato-600 transition-colors duration-100">
          Recently added
        </span>
        <span className="ml-auto shrink-0 text-ink-400 group-hover:text-tomato-600 transition-colors duration-100">
          <Icon
            name="chevron-right"
            size={16}
            className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      <CollapsePanel isOpen={isOpen}>
        <div className="pt-2 mb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        </div>
      </CollapsePanel>
    </section>
  );
}

/**
 * Card variant of the recipe summary — 4:3 photo on top, category
 * eyebrow + Newsreader title + mono total time below. Used by
 * RecentlyAdded; not currently used elsewhere but kept as a standalone
 * component so search-result grids and "shared with me" surfaces could
 * lift it without refactor.
 */
function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className={[
        "group flex flex-col bg-white rounded-lg overflow-hidden",
        "shadow-xs hover:shadow-md -translate-y-0 hover:-translate-y-px",
        "transition-[box-shadow,transform] duration-100 ease-out",
        "no-underline",
      ].join(" ")}
    >
      <PhotoFrame
        src={recipe.photoUrl}
        alt=""
        ratio="4 / 3"
        radius="none"
        border={false}
      />
      <div className="px-3.5 py-3 flex flex-col gap-0.5">
        <Eyebrow className="capitalize">{recipe.category}</Eyebrow>
        <div className="font-display font-medium text-[17px] leading-[1.2] tracking-[-0.005em] text-ink-900 mt-0.5 line-clamp-2">
          {recipe.title}
        </div>
        {recipe.totalTime && (
          <div className="font-mono text-[11px] text-ink-500 mt-1 [font-feature-settings:'tnum']">
            {recipe.totalTime}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <SprigDivider className="opacity-50 mb-4" />
      <p className="font-display italic text-[22px] text-ink-700 m-0">
        No recipes yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-2">
        Create one to get started.
      </p>
    </div>
  );
}

function ChapterSection({
  name,
  recipes,
  italic = false,
  isOpen,
  onToggle,
}: {
  name: string;
  recipes: RecipeSummary[];
  italic?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="border-b border-paper-300 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={[
          "w-full flex items-center gap-2.5 py-3 text-left cursor-pointer group",
          "transition-colors duration-100",
          italic ? "" : "",
        ].join(" ")}
      >
        <span
          className={[
            "font-display text-[22px] font-medium transition-colors duration-100",
            italic
              ? "italic text-ink-500 group-hover:text-ink-700"
              : "capitalize text-ink-900 group-hover:text-tomato-600",
          ].join(" ")}
        >
          {name}
        </span>
        <span className="font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
          {recipes.length}
        </span>
        <span
          className={[
            "ml-auto shrink-0 transition-colors duration-100",
            italic
              ? "text-ink-300 group-hover:text-ink-500"
              : "text-ink-400 group-hover:text-tomato-600",
          ].join(" ")}
        >
          <Icon
            name="chevron-right"
            size={16}
            className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      <CollapsePanel isOpen={isOpen}>
        <div className="pb-4">
          <RecipeList recipes={recipes} />
        </div>
      </CollapsePanel>
    </section>
  );
}

function RecipeList({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <div className="flex flex-col">
      {recipes.map((r) => (
        <RecipeRow key={r.id} recipe={r} />
      ))}
    </div>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeSummary }) {
  const hasMeta =
    recipe.totalTime || recipe.tags.length > 0 || recipe.access !== "owned";
  const favoriteCtx = useContext(FavoriteContext);
  const isFav = favoriteCtx?.favorites.has(recipe.id) ?? false;

  // Overlay-link pattern: the row is a relative-positioned div, the
  // `<Link>` is absolutely positioned across the whole row at z-0, and
  // any interactive controls (favorite toggle) sit at z-10 so clicks
  // hit them instead of bubbling to the link. This sidesteps the
  // invalid-HTML problem of nesting a <button> inside an <a>.
  return (
    <div
      className={[
        "group relative flex items-center gap-3.5 w-full",
        "border-b border-[var(--border-faint)] last:border-b-0",
        "px-3 py-3",
        "hover:bg-paper-200 hover:rounded-md hover:border-transparent",
        "transition-colors duration-100",
      ].join(" ")}
    >
      <Link
        to={`/recipes/${recipe.id}`}
        aria-label={`Open ${recipe.title}`}
        className="absolute inset-0 z-0 rounded-md no-underline"
      />
      <PhotoFrame
        src={recipe.photoUrl}
        alt=""
        ratio="1 / 1"
        radius="sm"
        className="shrink-0 w-16 h-16"
      />
      <div className="min-w-0 flex-1">
        <div
          className={[
            "font-display font-medium text-[18px] text-ink-900",
            "tracking-[-0.005em] leading-[1.2]",
            hasMeta ? "mb-1" : "",
          ].join(" ")}
        >
          {recipe.title}
        </div>
        {hasMeta && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {recipe.totalTime && (
              <span className="font-mono text-[11px] text-ink-500 [font-feature-settings:'tnum']">
                {recipe.totalTime}
              </span>
            )}
            {recipe.totalTime && recipe.tags.length > 0 && (
              <span className="text-[11px] text-ink-300">·</span>
            )}
            {recipe.tags.map((t) => (
              <Tag key={t} tone={tagToneFor(t)}>
                {t}
              </Tag>
            ))}
            {recipe.access !== "owned" && (
              <span
                className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-olive-700 bg-olive-100 px-1.5 py-0.5 rounded-sm"
                title={
                  recipe.access === "shared"
                    ? "Shared with you"
                    : "Auto-shared with you"
                }
              >
                <Icon name="share-2" size={10} />
                Shared
              </span>
            )}
          </div>
        )}
      </div>
      {favoriteCtx && (
        <button
          type="button"
          onClick={(e) => {
            // The button sits above the overlay link in the stacking
            // context, so this click never reaches it — but stop just
            // in case a future style change drops z-index.
            e.stopPropagation();
            favoriteCtx.onToggle(recipe.id);
          }}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFav}
          className={[
            "relative z-10 shrink-0 p-1.5 rounded-md transition-colors duration-100",
            isFav
              ? "text-tomato-500 hover:text-tomato-600"
              : "text-ink-300 hover:text-tomato-500",
            "hover:bg-paper-300/60",
          ].join(" ")}
        >
          <Icon name="heart" size={18} filled={isFav} />
        </button>
      )}
      <span className="relative z-0 text-ink-300 shrink-0 group-hover:text-ink-500 transition-colors duration-100">
        <Icon name="chevron-right" size={18} />
      </span>
    </div>
  );
}
