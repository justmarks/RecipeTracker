import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
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

export function Home() {
  const { user, loading, signInWithGoogle, signInWithMicrosoft, signOut } =
    useAuth();
  const { chapters } = useChapters(user?.uid);
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

  // Filter: every query token must prefix-match at least one of the
  // recipe's haystack tokens (searchTokens covers title + ingredients;
  // we also fold in tags and the chapter name). Comparison is
  // case-insensitive — chapter names like "BBQ" should still match a
  // "bbq" query, and stored data may be in any case.
  const filtered = useMemo(() => {
    if (queryTokens.length === 0) return recipes;
    return recipes.filter((r) => {
      const haystack = [...r.searchTokens, ...r.tags, r.category].map((h) =>
        h.toLowerCase(),
      );
      return queryTokens.every((q) => haystack.some((h) => h.startsWith(q)));
    });
  }, [recipes, queryTokens]);

  // Sort BEFORE grouping so each chapter section displays in the chosen order.
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortOrder === "alpha") {
      arr.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    } else {
      // Recent: createdAt desc; recipes missing createdAt sort to the end.
      arr.sort(
        (a, b) =>
          (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
      );
    }
    return arr;
  }, [filtered, sortOrder]);

  // Group sorted recipes by chapter, in the user's chapter order.
  // Map keys are lowercased so a "BBQ" chapter still buckets recipes
  // whose category happens to be stored as "bbq" or "Bbq".
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

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-slate-500">Loading…</p>
      </main>
    );
  }

  const searching = queryTokens.length > 0;
  const matchCount = filtered.length;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Marks Recipe Book</h1>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user.email ?? user.displayName}
            </span>
            <button
              onClick={() => signOut()}
              className="text-blue-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {user ? (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your recipes</h2>
            <div className="flex items-center gap-2">
              <Link
                to="/chapters"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Chapters
              </Link>
              <Link
                to="/import"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Import
              </Link>
              <Link
                to="/recipes/new"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                + New recipe
              </Link>
            </div>
          </div>

          {recipes.length > 0 && (
            <div className="mt-4 flex items-start gap-2">
              <div className="relative flex-1">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or ingredient…"
                  className="w-full rounded border border-slate-300 px-3 py-2 pr-10 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
                {searching && (
                  <p className="mt-1 text-xs text-slate-500">
                    {matchCount} match{matchCount === 1 ? "" : "es"}
                  </p>
                )}
              </div>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                aria-label="Sort order"
              >
                <option value="alpha">A → Z</option>
                <option value="recent">Recent first</option>
              </select>
            </div>
          )}

          {recipes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No recipes yet. Create one to get started.
            </p>
          ) : searching && matchCount === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No recipes match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {chapters.map((chapter) => {
                const items =
                  byChapter.groups.get(chapter.toLowerCase()) ?? [];
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
                <ChapterSection
                  name="Other"
                  recipes={byChapter.orphans}
                  italic
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-slate-600">Sign in to start saving recipes.</p>
          <button
            onClick={() =>
              signInWithGoogle().catch((err) =>
                console.error("Google sign-in:", err),
              )
            }
            className="block w-full max-w-xs rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Continue with Google
          </button>
          <button
            onClick={() =>
              signInWithMicrosoft().catch((err) =>
                console.error("Microsoft sign-in:", err),
              )
            }
            className="block w-full max-w-xs rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Continue with Microsoft
          </button>
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
      <h3
        className={`flex items-baseline gap-2 border-b border-slate-200 pb-1 text-base font-semibold ${
          italic ? "italic text-slate-500" : "capitalize text-slate-700"
        }`}
      >
        <span>{name}</span>
        <span className="text-xs font-normal text-slate-400">
          ({recipes.length})
        </span>
      </h3>
      <ul className="mt-2 divide-y divide-slate-200">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              to={`/recipes/${r.id}`}
              className="block py-2 hover:bg-slate-50"
            >
              <div className="font-medium">{r.title}</div>
              {r.tags.length > 0 && (
                <div className="text-xs text-slate-500">
                  {r.tags.join(", ")}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
