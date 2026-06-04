import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "../lib/useAuth";
import {
  generateGroceryList as runGenerate,
  useMealPlan,
} from "../lib/mealPlans";
import { useToast } from "../lib/useToast";
import { trackEvent } from "../lib/analytics";
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type GroceryCategory,
  type GroceryItem,
} from "shared";
import { Button, Eyebrow, Icon, SprigDivider } from "../components/ui";

/**
 * Grocery list — categorized shopping list generated from every recipe
 * in a meal plan. The Cloud Function does the heavy lifting (parsing,
 * consolidation, categorization via Claude) and writes the result onto
 * the plan doc; this page is a thin renderer over that cached value
 * with a "Regenerate" affordance for when the plan has changed since
 * the last build.
 *
 * Layout mirrors the meal plan detail page so the printed output reads
 * as a companion document: eyebrow + plan title, brief meta line,
 * each non-empty category as its own sprig-bordered section.
 */
export function GroceryList() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { plan, loading, error } = useMealPlan(user?.uid, id);

  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, GroceryItem[]>();
    const items = plan?.groceryList?.items ?? [];
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [plan?.groceryList?.items]);

  // The grocery list is "stale" when the plan's updatedAt is newer
  // than the moment we generated. updatedAt bumps any time a recipe
  // is added/removed (and on guest / notes / prep edits — those don't
  // affect ingredients, but they're cheap false positives the user can
  // ignore until they click Regenerate).
  const isStale = useMemo(() => {
    if (!plan?.groceryList) return false;
    const gen = plan.groceryListGeneratedAt?.toMillis() ?? 0;
    const upd = plan.updatedAt?.toMillis() ?? 0;
    return upd > gen + 1000; // 1s slack for clock drift between writes
  }, [plan?.groceryList, plan?.groceryListGeneratedAt, plan?.updatedAt]);

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (error) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
        <Button
          variant="ghost"
          icon="arrow-left"
          onClick={() => navigate("/meal-plans")}
          className="px-0"
        >
          Back
        </Button>
        <p className="mt-6 font-sans text-tomato-700">{error}</p>
      </div>
    );
  }
  if (!plan) return null;

  async function handleGenerate() {
    if (!id) return;
    setGenerating(true);
    setActionError(null);
    try {
      await runGenerate(id);
      // Track AFTER success so failed runs don't inflate the metric.
      // is_regeneration distinguishes the first build from later
      // refreshes after the plan changed.
      trackEvent("grocery_list_generated", {
        recipe_count: plan?.recipeIds.length ?? 0,
        is_regeneration: plan?.groceryList !== undefined,
      });
      toast.show("Grocery list ready.");
    } catch (err) {
      console.error("Generate grocery list:", err);
      const msg =
        err instanceof Error ? err.message : "Couldn't build grocery list.";
      setActionError(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handlePrint() {
    const previousTitle = document.title;
    document.title = `Grocery list — ${plan?.name || "Meal plan"}`.replace(
      /[\\/:*?"<>|]/g,
      " ",
    );
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const hasList = plan.groceryList && plan.groceryList.items.length > 0;
  const generatedAt = plan.groceryListGeneratedAt?.toDate() ?? null;

  return (
    <article className="mx-auto max-w-[760px] px-6 py-8 lg:px-10 lg:py-10 grocery-print">
      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <Button
          variant="ghost"
          icon="arrow-left"
          onClick={() => navigate(`/meal-plans/${id}`)}
          className="px-0"
        >
          Back to plan
        </Button>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            icon="printer"
            size="sm"
            onClick={handlePrint}
            disabled={!hasList}
            aria-label="Print"
          >
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            icon="sparkles"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            aria-label={hasList ? "Regenerate" : "Generate"}
          >
            <span className="hidden sm:inline">
              {generating
                ? "Building…"
                : hasList
                  ? "Regenerate"
                  : "Generate"}
            </span>
          </Button>
        </div>
      </div>

      <Eyebrow>Grocery list</Eyebrow>
      <h1 className="mt-1 font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.02em] text-ink-900 m-0">
        {plan.name}
      </h1>
      <p className="mt-2 font-sans text-sm text-ink-500 m-0">
        {plan.recipeIds.length} recipe
        {plan.recipeIds.length === 1 ? "" : "s"}
        {hasList && generatedAt && (
          <>
            <span aria-hidden="true" className="text-ink-300">
              {" · "}
            </span>
            Built {formatGeneratedAt(generatedAt)}
          </>
        )}
      </p>

      {isStale && hasList && (
        <div className="mt-4 rounded-md px-4 py-3 text-sm bg-saffron-100 text-saffron-700 border border-saffron-300/50 flex items-center gap-2 print:hidden">
          <Icon name="sparkles" size={14} />
          <span>
            Your meal plan changed since this list was built.{" "}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="underline font-semibold disabled:opacity-60"
            >
              Regenerate
            </button>
            .
          </span>
        </div>
      )}

      <SprigDivider />

      {actionError && (
        <div className="mb-4 rounded-md px-4 py-3 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100 print:hidden">
          {actionError}
        </div>
      )}

      {plan.recipeIds.length === 0 ? (
        <NoRecipesEmpty planId={plan.id} />
      ) : !plan.groceryList ? (
        <NotYetGenerated
          generating={generating}
          onGenerate={handleGenerate}
        />
      ) : plan.groceryList.items.length === 0 ? (
        <NoIngredientsFound onRegenerate={handleGenerate} />
      ) : (
        <div className="flex flex-col gap-7">
          {GROCERY_CATEGORIES.map((cat) => {
            const items = grouped.get(cat);
            if (!items || items.length === 0) return null;
            return <CategoryBlock key={cat} category={cat} items={items} />;
          })}
        </div>
      )}
    </article>
  );
}

function CategoryBlock({
  category,
  items,
}: {
  category: GroceryCategory;
  items: GroceryItem[];
}) {
  return (
    <section
      className="grocery-category"
      data-category={category}
    >
      <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-2 border-b border-paper-300 pb-1.5">
        {GROCERY_CATEGORY_LABELS[category]}
        <span className="ml-2 font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
          {items.length}
        </span>
      </h2>
      <ul className="list-none m-0 p-0 grocery-items">
        {items.map((item, i) => (
          <li
            key={`${category}-${i}`}
            className="flex items-start gap-3 px-2 py-1.5 border-b border-[var(--border-faint)] last:border-b-0"
          >
            {/*
              Print-ready check box. On screen we render an empty disc
              so the page feels like a worksheet; @media print
              promotes it to a solid-bordered square. No interactive
              check state in v1 — the use case is print-then-shop.
            */}
            <span
              aria-hidden="true"
              className={[
                "flex-none mt-1 w-4 h-4 rounded-sm border-2 border-paper-400",
                "print:border-ink-700",
              ].join(" ")}
            />
            <span className="flex-1 font-sans text-base text-ink-900 leading-snug">
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotYetGenerated({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="text-center py-12 print:hidden">
      <p className="font-display italic text-xl text-ink-700 m-0">
        No grocery list yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-2 max-w-[380px] mx-auto">
        Build one and we&rsquo;ll consolidate every ingredient across your
        recipes, sorted into the ten store aisles.
      </p>
      <div className="mt-5 inline-flex">
        <Button
          type="button"
          variant="primary"
          icon="sparkles"
          onClick={onGenerate}
          disabled={generating}
        >
          {generating ? "Building…" : "Generate grocery list"}
        </Button>
      </div>
      {generating && (
        <p className="font-sans text-xs text-ink-500 mt-3">
          This takes a few seconds — Claude is reading every recipe and
          merging duplicates.
        </p>
      )}
    </div>
  );
}

function NoRecipesEmpty({ planId }: { planId: string }) {
  return (
    <div className="text-center py-12 print:hidden">
      <p className="font-display italic text-xl text-ink-700 m-0">
        Nothing to shop for yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-2 max-w-[380px] mx-auto">
        Add some recipes to this meal plan, then come back to build the
        list.
      </p>
      <div className="mt-5 inline-flex">
        <Link to={`/meal-plans/${planId}`} className="no-underline">
          <Button type="button" variant="secondary" icon="arrow-left">
            Back to plan
          </Button>
        </Link>
      </div>
    </div>
  );
}

function NoIngredientsFound({ onRegenerate }: { onRegenerate: () => void }) {
  return (
    <div className="text-center py-12 print:hidden">
      <p className="font-display italic text-xl text-ink-700 m-0">
        Nothing to add to the list.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-2 max-w-[380px] mx-auto">
        The recipes in this plan don&rsquo;t have any ingredients yet, or
        the consolidation came back empty. Try regenerating.
      </p>
      <div className="mt-5 inline-flex">
        <Button
          type="button"
          variant="secondary"
          icon="sparkles"
          onClick={onRegenerate}
        >
          Regenerate
        </Button>
      </div>
    </div>
  );
}

function formatGeneratedAt(date: Date): string {
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `today at ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
  });
}
