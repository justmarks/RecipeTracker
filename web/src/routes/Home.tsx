import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../lib/useAuth";
import { useChapters } from "../lib/categories";
import { useRecipeList } from "../lib/queryRecipes";
import type { RecipeListItem } from "../lib/queryRecipes";
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
  const [params] = useSearchParams();
  const activeChapter = params.get("chapter") ?? "";

  // Merged stream of recipes I own + recipes explicitly shared with me +
  // recipes auto-shared with me. The hook handles the three-way fan-out.
  const { recipes } = useRecipeList(user?.uid);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("alpha");

  const queryTokens = useMemo(
    () =>
      search
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    [search],
  );

  // 1. URL chapter scope → 2. search filter (AND, prefix on tokens+tags+category)
  const filtered = useMemo(() => {
    let arr = recipes;
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
  }, [recipes, queryTokens, activeChapter]);

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
            {activeChapter || "All recipes"}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {activeChapter && (
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
        {activeChapter && (
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

      {recipes.length === 0 ? (
        <EmptyState />
      ) : searching && matchCount === 0 ? (
        <p className="font-sans text-sm text-ink-700 text-center py-12">
          No recipes match &ldquo;{search}&rdquo;.
        </p>
      ) : activeChapter ? (
        <RecipeList recipes={sorted} />
      ) : (
        <div className="flex flex-col gap-9">
          {chapters.map((chapter) => {
            const items = byChapter.groups.get(chapter.toLowerCase()) ?? [];
            if (items.length === 0) return null;
            return (
              <ChapterSection key={chapter} name={chapter} recipes={items} />
            );
          })}
          {byChapter.orphans.length > 0 && (
            <ChapterSection name="Other" recipes={byChapter.orphans} italic />
          )}
        </div>
      )}
    </div>
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
}: {
  name: string;
  recipes: RecipeSummary[];
  italic?: boolean;
}) {
  return (
    <section>
      <h2
        className={`flex items-baseline gap-2.5 border-b border-paper-300 pb-2 font-display text-[22px] font-medium m-0 mb-3 ${
          italic ? "italic text-ink-500" : "capitalize text-ink-900"
        }`}
      >
        {italic ? (
          <span>{name}</span>
        ) : (
          <Link
            to={`/?chapter=${encodeURIComponent(name)}`}
            className="no-underline text-ink-900 hover:text-tomato-600 transition-colors duration-100"
          >
            {name}
          </Link>
        )}
        <span className="font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
          {recipes.length}
        </span>
      </h2>
      <RecipeList recipes={recipes} />
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
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className={[
        "group flex items-center gap-3.5 w-full text-left no-underline",
        "border-b border-[var(--border-faint)] last:border-b-0",
        "px-3 py-3",
        "hover:bg-paper-200 hover:rounded-md hover:border-transparent",
        "transition-colors duration-100",
      ].join(" ")}
    >
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
      <span className="text-ink-300 shrink-0 group-hover:text-ink-500 transition-colors duration-100">
        <Icon name="chevron-right" size={18} />
      </span>
    </Link>
  );
}
