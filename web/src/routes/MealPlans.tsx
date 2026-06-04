import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "../lib/useAuth";
import { createMealPlan, useMealPlans } from "../lib/mealPlans";
import type { MealPlan } from "../lib/mealPlans";
import { trackEvent } from "../lib/analytics";
import { Button, Eyebrow, Icon, Input, SprigDivider } from "../components/ui";

/**
 * Meal plans index — list of every plan the user owns, newest first.
 * Each row links to the detail page where editing happens. Creating
 * a plan is a single name field; everything else (guests, notes,
 * recipes) is filled in from the detail page.
 *
 * Layout mirrors the chapters / tags management pages: page header
 * with title + primary action, a single bordered card holding the
 * list rows, generous empty state when there's nothing yet.
 */
export function MealPlans() {
  const { user, loading: authLoading } = useAuth();
  const { plans, loading } = useMealPlans(user?.uid);
  const navigate = useNavigate();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  function openAdd() {
    setNewName("");
    setError(null);
    setIsAdding(true);
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewName("");
  }

  async function handleCreate() {
    if (!user || !newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const id = await createMealPlan(user.uid, newName);
      trackEvent("meal_plan_created", { entry_point: "list" });
      setIsAdding(false);
      setNewName("");
      // Jump straight into the new plan so the user can flesh out
      // guests / notes / recipes without an extra click.
      navigate(`/meal-plans/${id}`);
    } catch (err) {
      console.error("Create meal plan:", err);
      setError(
        err instanceof Error ? err.message : "Couldn't create meal plan.",
      );
    } finally {
      setAdding(false);
    }
  }

  function goBack() {
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={goBack}
        className="px-0 mb-4"
      >
        Back
      </Button>

      <div className="mb-2 flex items-end justify-between gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0">
          Meal plans
        </h1>
        <Button
          type="button"
          variant="primary"
          icon="plus"
          size="sm"
          onClick={openAdd}
          disabled={isAdding}
        >
          <span className="hidden sm:inline">New meal plan</span>
        </Button>
      </div>
      <p className="font-sans text-sm text-ink-700 m-0 mb-6 max-w-[480px]">
        Bundle recipes around an occasion — a Thanksgiving menu, Friday
        dinner, a kid&rsquo;s birthday. Add guests so you remember how many
        to cook for; notes for the running thread of ideas.
      </p>

      {isAdding && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-[var(--border-faint)] bg-paper-50 px-4 py-3">
          <Input
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Thanksgiving 2026"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              } else if (e.key === "Escape") {
                cancelAdd();
              }
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={adding || !newName.trim()}
          >
            {adding ? "Creating…" : "Create"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelAdd}
            disabled={adding}
          >
            Cancel
          </Button>
        </div>
      )}

      {loading ? (
        <p className="font-sans text-sm text-ink-500">Loading…</p>
      ) : plans.length === 0 ? (
        <EmptyState onCreate={openAdd} hasAddOpen={isAdding} />
      ) : (
        <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
          {plans.map((plan, i) => (
            <li
              key={plan.id}
              className={[
                "transition-colors duration-100 hover:bg-paper-100",
                i === plans.length - 1
                  ? ""
                  : "border-b border-[var(--border-faint)]",
              ].join(" ")}
            >
              <PlanRow plan={plan} />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-4 rounded-md px-4 py-3 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100">
          {error}
        </div>
      )}
    </div>
  );
}

function PlanRow({ plan }: { plan: MealPlan }) {
  // Family groups carry per-row adult + kid counts; sum across the
  // list for the at-a-glance summary on the index row.
  const adultCount = plan.guests.reduce(
    (sum, g) => sum + (g.adults || 0),
    0,
  );
  const childCount = plan.guests.reduce(
    (sum, g) => sum + (g.kids || 0),
    0,
  );
  const totalGuests = adultCount + childCount;
  const recipeCount = plan.recipeIds.length;

  return (
    <Link
      to={`/meal-plans/${plan.id}`}
      className="block px-4 py-3.5 no-underline"
    >
      <div className="flex items-center gap-3">
        <div className="flex-none w-10 h-10 rounded-md bg-saffron-100 text-saffron-700 flex items-center justify-center">
          <Icon name="utensils" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-medium text-md text-ink-900 leading-tight truncate flex items-center gap-2">
            <span className="truncate">{plan.name}</span>
            {plan.access !== "owned" && (
              <span
                className="inline-flex items-center gap-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-olive-700 bg-olive-100 px-1.5 py-0.5 rounded-sm shrink-0"
                title={
                  plan.access === "shared"
                    ? "Shared directly with you"
                    : "Auto-shared with you"
                }
              >
                <Icon name="share-2" size={9} />
                Shared
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-sans text-xs text-ink-500 flex-wrap">
            <span>
              {recipeCount} recipe{recipeCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true" className="text-ink-300">
              ·
            </span>
            <span>
              {totalGuests === 0
                ? "No guests yet"
                : guestSummary(totalGuests, adultCount, childCount)}
            </span>
            {(plan.date || plan.createdAt) && (
              <>
                <span aria-hidden="true" className="text-ink-300">
                  ·
                </span>
                <span>
                  {plan.date
                    ? formatEventDate(plan.date)
                    : formatCreatedAt(plan.createdAt!.toDate())}
                </span>
              </>
            )}
          </div>
        </div>
        <span className="text-ink-300 shrink-0">
          <Icon name="chevron-right" size={16} />
        </span>
      </div>
    </Link>
  );
}

function guestSummary(total: number, adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} adult${adults === 1 ? "" : "s"}`);
  if (children > 0)
    parts.push(`${children} kid${children === 1 ? "" : "s"}`);
  if (parts.length === 0) return `${total} guest${total === 1 ? "" : "s"}`;
  return parts.join(" · ");
}

function formatCreatedAt(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date().getFullYear() === date.getFullYear() ? undefined : "numeric",
  });
}

function formatEventDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date().getFullYear() === year ? undefined : "numeric",
  });
}

function EmptyState({
  onCreate,
  hasAddOpen,
}: {
  onCreate: () => void;
  hasAddOpen: boolean;
}) {
  if (hasAddOpen) return null;
  return (
    <div className="text-center py-16">
      <SprigDivider className="opacity-50 mb-4" />
      <p className="font-display italic text-xl text-ink-700 m-0">
        No meal plans yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-2 max-w-[360px] mx-auto">
        Create a plan to gather recipes for a dinner, holiday, or any
        occasion you&rsquo;re cooking for.
      </p>
      <div className="mt-5 inline-flex">
        <Button
          type="button"
          variant="primary"
          icon="plus"
          onClick={onCreate}
        >
          New meal plan
        </Button>
      </div>
      <Eyebrow className="mt-8 opacity-60">tip</Eyebrow>
      <p className="font-sans text-xs text-ink-500 mt-1 max-w-[320px] mx-auto">
        Open any recipe and tap &ldquo;Add to plan&rdquo; to drop it into a
        meal plan.
      </p>
    </div>
  );
}
