import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/useAuth";
import {
  addRecipeToMealPlan,
  createMealPlan,
  useMealPlans,
} from "../lib/mealPlans";
import { Button, Icon, Input, Tag } from "./ui";

interface AddToMealPlanDialogProps {
  open: boolean;
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
  /**
   * Optional toast callback fired with a short confirmation each time
   * a recipe is added or a plan is created. Lets the parent route
   * messages through its existing toast hub.
   */
  onMessage?: (msg: string) => void;
}

/**
 * Dialog for dropping a recipe into one of the user's meal plans.
 * Lists every plan with a check / disabled state on ones that already
 * contain the recipe (idempotent — clicking again is a no-op), plus a
 * "+ New meal plan" affordance that creates the plan and adds the
 * recipe in one click.
 *
 * Plans render with their guest summary so the user can pick the right
 * one when they have several active plans going.
 */
export function AddToMealPlanDialog({
  open,
  recipeId,
  recipeTitle,
  onClose,
  onMessage,
}: AddToMealPlanDialogProps) {
  const { user } = useAuth();
  const { plans, loading } = useMealPlans(user?.uid);
  const ref = useRef<HTMLDialogElement>(null);

  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state every time the dialog re-opens so a stale
  // error from a previous attempt doesn't linger.
  useEffect(() => {
    if (open) {
      setError(null);
      setShowCreate(false);
      setNewName("");
      setBusyPlanId(null);
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const sortedPlans = useMemo(() => {
    // Already-added plans float down so empty plans (the most likely
    // add targets) sit at the top. Within each group, preserve the
    // newest-first ordering coming from useMealPlans.
    const containing: typeof plans = [];
    const empty: typeof plans = [];
    for (const p of plans) {
      if (p.recipeIds.includes(recipeId)) containing.push(p);
      else empty.push(p);
    }
    return [...empty, ...containing];
  }, [plans, recipeId]);

  async function handleAdd(planId: string) {
    setBusyPlanId(planId);
    setError(null);
    try {
      await addRecipeToMealPlan(planId, recipeId);
      const plan = plans.find((p) => p.id === planId);
      onMessage?.(`Added to "${plan?.name ?? "meal plan"}".`);
    } catch (err) {
      console.error("Add recipe to plan:", err);
      setError(err instanceof Error ? err.message : "Couldn't add recipe.");
    } finally {
      setBusyPlanId(null);
    }
  }

  async function handleCreateAndAdd() {
    if (!user || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createMealPlan(user.uid, newName);
      await addRecipeToMealPlan(id, recipeId);
      onMessage?.(`Created "${newName.trim()}" and added recipe.`);
      setShowCreate(false);
      setNewName("");
    } catch (err) {
      console.error("Create plan + add recipe:", err);
      setError(
        err instanceof Error ? err.message : "Couldn't create meal plan.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={[
        "m-auto p-0 bg-transparent border-0",
        "backdrop:bg-ink-900/50",
      ].join(" ")}
    >
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-[480px] w-[92vw] max-h-[80vh] flex flex-col">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 leading-snug">
          Add to meal plan
        </h2>
        <p className="font-sans text-sm leading-relaxed text-ink-700 m-0 mt-1 mb-4">
          Pick a plan for{" "}
          <span className="font-semibold text-ink-900">{recipeTitle}</span>.
        </p>

        <div className="overflow-y-auto -mx-2 px-2 flex-1">
          {loading ? (
            <p className="font-sans text-sm text-ink-500">Loading…</p>
          ) : sortedPlans.length === 0 && !showCreate ? (
            <div className="text-center py-6">
              <p className="font-display italic text-md text-ink-700 m-0">
                No meal plans yet.
              </p>
              <p className="font-sans text-sm text-ink-500 mt-1 mb-3">
                Create one to drop this recipe into.
              </p>
              <Button
                type="button"
                variant="primary"
                icon="plus"
                onClick={() => setShowCreate(true)}
              >
                New meal plan
              </Button>
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {sortedPlans.map((plan) => {
                const isAdded = plan.recipeIds.includes(recipeId);
                const isBusy = busyPlanId === plan.id;
                return (
                  <li
                    key={plan.id}
                    className="border-b border-[var(--border-faint)] last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => !isAdded && !isBusy && handleAdd(plan.id)}
                      disabled={isAdded || isBusy}
                      className={[
                        "w-full flex items-center gap-3 px-2 py-2.5 rounded",
                        "text-left transition-colors duration-100",
                        isAdded
                          ? "cursor-default opacity-70"
                          : "cursor-pointer hover:bg-paper-100",
                      ].join(" ")}
                    >
                      <div className="flex-none w-9 h-9 rounded-md bg-saffron-100 text-saffron-700 flex items-center justify-center">
                        <Icon name="utensils" size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-sans font-semibold text-sm text-ink-900 leading-tight truncate">
                          {plan.name}
                        </div>
                        <div className="mt-0.5 font-sans text-xs text-ink-500 truncate">
                          {plan.recipeIds.length} recipe
                          {plan.recipeIds.length === 1 ? "" : "s"}
                          {plan.guests.length > 0 && (
                            <>
                              <span aria-hidden="true" className="text-ink-300">
                                {" · "}
                              </span>
                              {plan.guests.length} guest
                              {plan.guests.length === 1 ? "" : "s"}
                            </>
                          )}
                        </div>
                      </div>
                      {isAdded ? (
                        <Tag tone="olive">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="check" size={11} /> Added
                          </span>
                        </Tag>
                      ) : isBusy ? (
                        <span className="font-sans text-xs text-ink-500">
                          Adding…
                        </span>
                      ) : (
                        <Icon
                          name="plus"
                          size={16}
                          className="text-tomato-600"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!showCreate && sortedPlans.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-3 inline-flex items-center gap-1.5 font-sans text-sm font-medium text-tomato-600 hover:text-tomato-700 self-start"
          >
            <Icon name="plus" size={14} /> New meal plan
          </button>
        )}

        {showCreate && (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sunday dinner"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateAndAdd();
                } else if (e.key === "Escape") {
                  setShowCreate(false);
                  setNewName("");
                }
              }}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreateAndAdd}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating…" : "Create + add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-md px-3 py-2 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
