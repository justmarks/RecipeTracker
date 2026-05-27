import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { DocumentData, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useChapters } from "../lib/categories";

type RecipeSummary = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  searchTokens: string[];
  createdAt?: Timestamp;
};

type SortOrder = "alpha" | "recent";

/**
 * Recipe list — the index route. The sidebar owns brand/nav/actions
 * now; this page is just the content. When `?chapter=<name>` is
 * present in the URL, the list scopes to that single chapter and the
 * page header swaps to a "Browsing X · Show all" affordance.
 */
export function Home() {
  const { user } = useAuth();
  const { chapters } = useChapters(user?.uid);
  const [params] = useSearchParams();
  const activeChapter = params.get("chapter") ?? "";

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("alpha");

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "recipes"),
      where("ownerId", "==", user.uid),
      orderBy("updatedAt", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setRecipes(
          snap.docs.map((d) => {
            const data = d.data() as DocumentData;
            return {
              id: d.id,
              title: data.title,
              category: data.category,
              tags: data.tags ?? [],
              searchTokens: data.searchTokens ?? [],
              createdAt: data.createdAt as Timestamp | undefined,
            };
          }),
        );
      },
      (err) => {
        console.error("Recipe list:", err);
      },
    );
  }, [user]);

  // Tokenize the search query the same way recipe writes do — lowercase,
  // drop punctuation, require at least 2 chars per token. Keeps the
  // matching consistent with what's stored in searchTokens.
  const queryTokens = useMemo(
    () =>
      search
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    [search],
  );

  // Filter pipeline:
  //   1. URL `?chapter=` → scope to that single chapter (case-insensitive)
  //   2. Search tokens (AND, prefix-match) over searchTokens + tags + category
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

  // Group by chapter — only relevant when no chapter is selected
  // (when one is selected, the filter is already scoped to one bucket).
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
    <main className="mx-auto max-w-3xl p-6 lg:p-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 capitalize m-0">
          {activeChapter || "All recipes"}
        </h1>
        {activeChapter && (
          <Link
            to="/"
            className="text-sm text-tomato-600 hover:text-tomato-700 no-underline whitespace-nowrap"
          >
            Show all
          </Link>
        )}
      </header>

      {recipes.length > 0 && (
        <div className="mt-6 flex items-start gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or ingredient…"
              className="w-full font-sans text-sm text-ink-900 bg-white border border-paper-400 rounded-md px-3 py-2.5 pr-10 outline-none transition-colors duration-100 focus:border-tomato-500 focus:shadow-[var(--shadow-focus)] placeholder:text-ink-300"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-700"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
            {searching && (
              <p className="mt-1 text-xs text-ink-500">
                {matchCount} match{matchCount === 1 ? "" : "es"}
              </p>
            )}
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="font-sans text-sm text-ink-900 bg-white border border-paper-400 rounded-md px-3 py-2.5 cursor-pointer transition-colors duration-100 focus:border-tomato-500 focus:shadow-[var(--shadow-focus)] focus:outline-none"
            aria-label="Sort order"
          >
            <option value="alpha">A → Z</option>
            <option value="recent">Recent first</option>
          </select>
        </div>
      )}

      {recipes.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">
          No recipes yet. Create one to get started.
        </p>
      ) : searching && matchCount === 0 ? (
        <p className="mt-8 text-sm text-ink-500">
          No recipes match &ldquo;{search}&rdquo;.
        </p>
      ) : activeChapter ? (
        // Single-chapter view: just one flat list, no section headers.
        <RecipeList recipes={sorted} />
      ) : (
        <div className="mt-8 space-y-8">
          {chapters.map((chapter) => {
            const items = byChapter.groups.get(chapter.toLowerCase()) ?? [];
            if (items.length === 0) return null;
            return (
              <ChapterSection
                key={chapter}
                name={chapter}
                recipes={items}
              />
            );
          })}
          {byChapter.orphans.length > 0 && (
            <ChapterSection name="Other" recipes={byChapter.orphans} italic />
          )}
        </div>
      )}
    </main>
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
        className={`flex items-baseline gap-2 border-b border-paper-300 pb-1.5 font-display text-xl ${
          italic ? "italic text-ink-500" : "capitalize text-ink-900"
        }`}
      >
        <Link
          to={italic ? "/" : `/?chapter=${encodeURIComponent(name)}`}
          className={`no-underline ${
            italic ? "text-ink-500" : "text-ink-900 hover:text-tomato-600"
          }`}
        >
          {name}
        </Link>
        <span className="font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
          ({recipes.length})
        </span>
      </h2>
      <RecipeList recipes={recipes} />
    </section>
  );
}

function RecipeList({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <ul className="mt-2 divide-y divide-paper-300">
      {recipes.map((r) => (
        <li key={r.id}>
          <Link
            to={`/recipes/${r.id}`}
            className="block py-2.5 hover:bg-paper-200 no-underline rounded-md px-2 -mx-2 transition-colors duration-100"
          >
            <div className="font-display text-base text-ink-900">
              {r.title}
            </div>
            {r.tags.length > 0 && (
              <div className="text-xs text-ink-500 mt-0.5">
                {r.tags.join(" · ")}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
