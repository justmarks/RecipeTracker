import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "../lib/useAuth";
import {
  deleteMealPlan,
  newGuestId,
  newPrepId,
  removeRecipeFromMealPlan,
  renameMealPlan,
  updateMealPlanMeta,
  useMealPlan,
} from "../lib/mealPlans";
import { useRecipeList } from "../lib/queryRecipes";
import type { RecipeListItem } from "../lib/queryRecipes";
import { useToast } from "../lib/useToast";
import type { AdditionalItem, GuestGroup } from "shared";
import {
  Button,
  CollapsibleSection,
  ConfirmDialog,
  Eyebrow,
  Icon,
  Input,
  PhotoFrame,
  SprigDivider,
  Textarea,
} from "../components/ui";
import { PrepNotesEditor } from "../components/PrepNotesEditor";

/**
 * Meal plan detail — the editorial page where a plan lives. Inline
 * rename on the title (mirrors Chapters / Tags pages), inline-editable
 * guest list with adult/child toggle + delete, live-saved notes, and
 * a recipe list with quick remove. The print button kicks the browser
 * print flow; @media print styles (index.css + the .print:hidden marks
 * on the chrome here) take care of the page layout.
 */
export function MealPlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { plan, loading, error } = useMealPlan(user?.uid, id);
  const { recipes } = useRecipeList(user?.uid);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Collapsible section state. Default expanded so first-time users
  // see the affordances; click on the section header to collapse. We
  // intentionally don't persist this across reloads — the page is
  // short enough that the user's preference doesn't outweigh the
  // discovery benefit of arriving at a fully-laid-out plan.
  const [guestsOpen, setGuestsOpen] = useState(true);
  const [prepOpen, setPrepOpen] = useState(true);

  // Local guest state with debounced save — the dialog-style "save when
  // the user pauses typing" pattern keeps every keystroke from hitting
  // Firestore while still feeling immediate. Notes use the same trick.
  const [guests, setGuests] = useState<GuestGroup[]>([]);
  const [notes, setNotes] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);
  const guestsHydratedRef = useRef(false);
  const notesHydratedRef = useRef(false);
  const prepHydratedRef = useRef(false);
  const additionalHydratedRef = useRef(false);

  useEffect(() => {
    if (!plan) return;
    if (!guestsHydratedRef.current) {
      setGuests(plan.guests);
      guestsHydratedRef.current = true;
    }
    if (!notesHydratedRef.current) {
      setNotes(plan.notes ?? "");
      notesHydratedRef.current = true;
    }
    if (!prepHydratedRef.current) {
      setPrepNotes(plan.prepNotes);
      prepHydratedRef.current = true;
    }
    if (!additionalHydratedRef.current) {
      setAdditionalItems(plan.additionalItems);
      additionalHydratedRef.current = true;
    }
  }, [plan]);

  // Debounced saves — wait until the user stops editing for 600ms
  // before writing. The cleanup cancels the pending save on the next
  // edit, so rapid typing only fires one Firestore write at the end.
  const guestsDirtyRef = useRef(false);
  useEffect(() => {
    if (!plan || !id) return;
    if (!guestsHydratedRef.current) return;
    if (!guestsDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void updateMealPlanMeta(id, { guests }).catch((err) => {
        console.error("Save guests:", err);
        toast.show("Couldn't save guests.");
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [guests, id, plan, toast]);

  const notesDirtyRef = useRef(false);
  useEffect(() => {
    if (!plan || !id) return;
    if (!notesHydratedRef.current) return;
    if (!notesDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void updateMealPlanMeta(id, { notes }).catch((err) => {
        console.error("Save notes:", err);
        toast.show("Couldn't save notes.");
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [notes, id, plan, toast]);

  const prepDirtyRef = useRef(false);
  useEffect(() => {
    if (!plan || !id) return;
    if (!prepHydratedRef.current) return;
    if (!prepDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void updateMealPlanMeta(id, { prepNotes }).catch((err) => {
        console.error("Save prep notes:", err);
        toast.show("Couldn't save prep notes.");
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [prepNotes, id, plan, toast]);

  const additionalDirtyRef = useRef(false);
  useEffect(() => {
    if (!plan || !id) return;
    if (!additionalHydratedRef.current) return;
    if (!additionalDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void updateMealPlanMeta(id, { additionalItems }).catch((err) => {
        console.error("Save additional items:", err);
        toast.show("Couldn't save additional items.");
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [additionalItems, id, plan, toast]);

  // Resolve recipe ids against the in-memory recipe stream (owned +
  // shared + auto). Preserves the plan's insertion order; unresolved
  // ids (deleted recipe, revoked share) render as a "no longer
  // available" placeholder so the user can still remove them.
  const recipesById = useMemo(() => {
    const m = new Map<string, RecipeListItem>();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

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

  // Aggregate across all families/groups so the summary chip + the
  // meta line under the title both show consistent totals.
  const adultCount = guests.reduce((sum, g) => sum + (g.adults || 0), 0);
  const childCount = guests.reduce((sum, g) => sum + (g.kids || 0), 0);
  const guestCount = adultCount + childCount;

  async function handleRename() {
    if (!id || !renameValue.trim()) return;
    setBusy(true);
    setPageError(null);
    try {
      await renameMealPlan(id, renameValue);
      setIsRenaming(false);
    } catch (err) {
      console.error("Rename meal plan:", err);
      setPageError(
        err instanceof Error ? err.message : "Couldn't rename plan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteMealPlan(id);
      setConfirmDelete(false);
      toast.show(`Deleted "${plan?.name ?? "meal plan"}"`);
      navigate("/meal-plans", { replace: true });
    } catch (err) {
      console.error("Delete meal plan:", err);
      setPageError(
        err instanceof Error ? err.message : "Couldn't delete plan.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveRecipe(recipeId: string) {
    if (!id) return;
    try {
      await removeRecipeFromMealPlan(id, recipeId);
    } catch (err) {
      console.error("Remove recipe:", err);
      toast.show(
        err instanceof Error
          ? `Couldn't remove recipe: ${err.message}`
          : "Couldn't remove recipe.",
      );
    }
  }

  // Guests — each row is a family/group, not an individual. We don't
  // try to keep the same person across edits; the family stays put
  // and the counts move.
  function addFamily() {
    guestsDirtyRef.current = true;
    setGuests((prev) => [
      ...prev,
      { id: newGuestId(), name: "", adults: 0, kids: 0 },
    ]);
  }

  function updateFamily(idx: number, patch: Partial<GuestGroup>) {
    guestsDirtyRef.current = true;
    setGuests((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    );
  }

  function removeFamily(idx: number) {
    guestsDirtyRef.current = true;
    setGuests((prev) => prev.filter((_, i) => i !== idx));
  }

  // Prep notes — single markdown string. Both raw edits in the
  // textarea and rendered-checkbox toggles route through the same
  // setter, so the debounced save effect catches every mutation.
  function setPrepNotesAndMarkDirty(next: string) {
    prepDirtyRef.current = true;
    setPrepNotes(next);
  }

  // Additional items — non-recipe menu lines (Crudité, wine, bread the
  // guest is bringing). Always-editable rows like the prep list.
  function addAdditionalItem() {
    additionalDirtyRef.current = true;
    setAdditionalItems((prev) => [
      ...prev,
      { id: newPrepId(), name: "", broughtBy: undefined },
    ]);
  }

  function updateAdditionalItem(
    idx: number,
    patch: Partial<AdditionalItem>,
  ) {
    additionalDirtyRef.current = true;
    setAdditionalItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function removeAdditionalItem(idx: number) {
    additionalDirtyRef.current = true;
    setAdditionalItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handlePrint() {
    const previousTitle = document.title;
    document.title = (plan?.name || "Meal plan")
      .replace(/[\\/:*?"<>|]/g, " ")
      .trim();
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <article className="mx-auto max-w-[760px] px-6 py-8 lg:px-10 lg:py-10 meal-plan-print">
      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <Button
          variant="ghost"
          icon="arrow-left"
          onClick={() => navigate("/meal-plans")}
          className="px-0"
        >
          All plans
        </Button>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/meal-plans/${id}/grocery`}
            className="no-underline"
            aria-label="Grocery list"
          >
            <Button
              type="button"
              variant="secondary"
              icon="sparkles"
              size="sm"
            >
              <span className="hidden sm:inline">Grocery list</span>
            </Button>
          </Link>
          <Button
            type="button"
            variant="secondary"
            icon="printer"
            size="sm"
            onClick={handlePrint}
            aria-label="Print"
          >
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            type="button"
            variant="danger"
            icon="trash"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete"
          >
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>

      <Eyebrow>Meal plan</Eyebrow>

      {isRenaming ? (
        <div className="mt-1 flex items-center gap-2 print:hidden">
          <Input
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRename();
              } else if (e.key === "Escape") {
                setIsRenaming(false);
                setRenameValue("");
              }
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleRename}
            disabled={busy || !renameValue.trim()}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsRenaming(false);
              setRenameValue("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsRenaming(true);
            setRenameValue(plan.name);
          }}
          className={[
            "mt-1 block w-full text-left",
            "font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.02em] text-ink-900 m-0",
            "rounded px-2 py-1 -mx-2 -my-1",
            "hover:bg-paper-200 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
            "transition-colors duration-100",
          ].join(" ")}
          title="Click to rename"
        >
          {plan.name}
        </button>
      )}

      <p className="mt-3 mb-0 font-sans text-sm text-ink-500">
        {guestCount === 0
          ? "No guests yet."
          : countSummary(adultCount, childCount)}
        {plan.recipeIds.length > 0 && (
          <>
            <span aria-hidden="true" className="text-ink-300">
              {" · "}
            </span>
            {plan.recipeIds.length} recipe
            {plan.recipeIds.length === 1 ? "" : "s"}
          </>
        )}
      </p>

      <SprigDivider />

      <div className="mb-8">
        <CollapsibleSection
          title="Guests"
          open={guestsOpen}
          onToggle={() => setGuestsOpen((v) => !v)}
          alwaysShowSummary
          summary={
            guests.length === 0
              ? "None yet"
              : countSummary(adultCount, childCount)
          }
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              // Auto-expand on add so the new row is visible.
              onClick={() => {
                setGuestsOpen(true);
                addFamily();
              }}
            >
              <span className="hidden sm:inline">Add family</span>
            </Button>
          }
        >
          {guests.length === 0 ? (
            <p className="font-sans text-sm text-ink-500 m-0">
              Add the families you&rsquo;re cooking for so you remember
              how many portions to plan. Each row tracks a group with
              adult and kid counts.
            </p>
          ) : (
            <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
              {guests.map((g, i) => (
                <li
                  key={g.id}
                  className={[
                    "flex items-center gap-2 px-3.5 py-2.5 flex-wrap sm:flex-nowrap",
                    i === guests.length - 1
                      ? ""
                      : "border-b border-[var(--border-faint)]",
                  ].join(" ")}
                >
                  {/* Screen: family name + numeric counts. Print:
                      replace inputs with a one-line summary span. */}
                  <Input
                    value={g.name}
                    onChange={(e) =>
                      updateFamily(i, { name: e.target.value })
                    }
                    placeholder="McMullen Family"
                    className="flex-1 min-w-[180px] print:hidden"
                  />
                  <CountStepper
                    label="adults"
                    value={g.adults}
                    onChange={(adults) => updateFamily(i, { adults })}
                  />
                  <CountStepper
                    label="kids"
                    value={g.kids}
                    onChange={(kids) => updateFamily(i, { kids })}
                  />
                  <span className="hidden print:inline font-sans">
                    {g.name || "(unnamed)"} —{" "}
                    {g.adults} adult{g.adults === 1 ? "" : "s"},{" "}
                    {g.kids} kid{g.kids === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFamily(i)}
                    aria-label={`Remove ${g.name || "family"}`}
                    className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
      </div>

      

      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-xl font-medium text-ink-900 m-0">
            Recipes
          </h2>
          <Link to="/" className="no-underline print:hidden">
            <Button type="button" variant="secondary" size="sm" icon="plus">
              <span className="hidden sm:inline">Browse recipes</span>
            </Button>
          </Link>
        </div>

        {plan.recipeIds.length === 0 ? (
          <RecipesEmptyState />
        ) : (
          <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
            {plan.recipeIds.map((rid, i) => {
              const recipe = recipesById.get(rid);
              const isLast = i === plan.recipeIds.length - 1;
              return (
                <li
                  key={rid}
                  className={[
                    "flex items-center gap-3 px-3.5 py-3",
                    isLast ? "" : "border-b border-[var(--border-faint)]",
                  ].join(" ")}
                >
                  {recipe ? (
                    <ResolvedRecipeRow
                      recipe={recipe}
                      onRemove={() => handleRemoveRecipe(rid)}
                    />
                  ) : (
                    <UnresolvedRecipeRow
                      onRemove={() => handleRemoveRecipe(rid)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 additional-items">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-xl font-medium text-ink-900 m-0">
            Additional items
          </h2>
          <div className="print:hidden">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={addAdditionalItem}
            >
              <span className="hidden sm:inline">Add item</span>
            </Button>
          </div>
        </div>

        {additionalItems.length === 0 ? (
          <p className="font-sans text-sm text-ink-500 m-0">
            Track non-recipe items here — crudité, wine, dessert from
            the bakery, or anything a guest is bringing.
          </p>
        ) : (
          <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
            {additionalItems.map((item, i) => (
              <li
                key={item.id}
                className={[
                  "flex items-center gap-2 px-3.5 py-2.5",
                  i === additionalItems.length - 1
                    ? ""
                    : "border-b border-[var(--border-faint)]",
                ].join(" ")}
              >
                {/*
                  Screen view: two inputs side-by-side. Hidden on
                  print because `<input>` elements can't host the
                  pseudo-content needed to merge them into a single
                  bulleted "Name — brought by Alice" line.
                */}
                <Input
                  value={item.name}
                  onChange={(e) =>
                    updateAdditionalItem(i, { name: e.target.value })
                  }
                  placeholder="Crudité, wine, dessert…"
                  className="flex-1 print:hidden"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAdditionalItem();
                    }
                  }}
                />
                <Input
                  value={item.broughtBy ?? ""}
                  onChange={(e) =>
                    updateAdditionalItem(i, {
                      // Empty string clears the field so the print
                      // template can hide the suffix entirely.
                      broughtBy: e.target.value || undefined,
                    })
                  }
                  placeholder="Brought by…"
                  // Narrower than the name field — it's a side label,
                  // not the primary content.
                  className="w-40 sm:w-48 shrink-0 print:hidden"
                />
                {/*
                  Print view: a single span that prints the joined
                  line. Bullet from the CSS list-style; ` — Brought by
                  X` appended only when broughtBy is set.
                */}
                <span className="hidden print:inline font-sans">
                  {item.name || "(unnamed item)"}
                  {item.broughtBy && (
                    <span className="text-ink-500">
                      {" — brought by "}
                      {item.broughtBy}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeAdditionalItem(i)}
                  aria-label={`Remove ${item.name || "additional item"}`}
                  title="Remove"
                  className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
                >
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <CollapsibleSection
          title="Prep list"
          className="prep-list"
          open={prepOpen}
          onToggle={() => setPrepOpen((v) => !v)}
          alwaysShowSummary
          summary={prepMarkdownSummary(prepNotes)}
        >
          <PrepNotesEditor
            value={prepNotes}
            onChange={setPrepNotesAndMarkDirty}
          />
        </CollapsibleSection>
      </div>

      {/*
        Notes are the catch-all for plan-level thoughts ("Bring extra
        wine", "Confirm RSVP by Friday"). They live at the BOTTOM of
        the page so the active surfaces — guests, recipes, menu
        additions — sit where the user lands first. The prep list
        markdown editor covers most "what to do" use cases anyway.
      */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3">
          Notes
        </h2>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => {
            notesDirtyRef.current = true;
            setNotes(e.target.value);
          }}
          placeholder="Menu order, confirmations, anything you don't want to forget."
          className="print:border-0 print:bg-transparent print:p-0"
        />
        {!notes && (
          <span className="hidden print:block font-sans text-sm text-ink-500">
            —
          </span>
        )}
      </section>

      {pageError && (
        <div className="mt-6 rounded-md px-4 py-3 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100 print:hidden">
          {pageError}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this meal plan?"
        message={`"${plan.name}" will be permanently removed. The recipes themselves stay in your library.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel="Keep"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </article>
  );
}

/**
 * Render an adult/kid count as a single string. Used for both the
 * meta line under the page title and the Guests collapsible header
 * summary, so the totals always read the same. Empty totals collapse
 * to "0 adults" instead of a misleading empty string.
 */
function countSummary(adults: number, children: number): string {
  const parts: string[] = [];
  parts.push(`${adults} adult${adults === 1 ? "" : "s"}`);
  parts.push(`${children} kid${children === 1 ? "" : "s"}`);
  return parts.join(", ");
}

/**
 * One-line summary of the prep notes markdown. Counts task checkboxes
 * (`- [ ]` / `- [x]`) and reports "N of M done" so the user can scan
 * progress with the section collapsed. Falls back to a generic
 * "Empty" / "Notes" indicator when no tasks are present.
 */
function prepMarkdownSummary(md: string): string {
  if (!md.trim()) return "Empty";
  const taskOpen = (md.match(/^[\s]*[-*]\s\[\s\]/gm) ?? []).length;
  const taskDone = (md.match(/^[\s]*[-*]\s\[[xX]\]/gm) ?? []).length;
  const total = taskOpen + taskDone;
  if (total === 0) return "Notes";
  return `${taskDone} of ${total} done`;
}

interface CountStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
}

/**
 * Compact +/- counter for the adult / kid columns. Tighter than a
 * native number input and labelled in the design system's voice. Caps
 * at the schema max (50) to match Zod validation, and clamps at zero
 * so an over-eager click can't drive the count negative.
 */
function CountStepper({ label, value, onChange }: CountStepperProps) {
  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(Math.min(50, value + 1));
  return (
    <div className="inline-flex items-center gap-1 print:hidden">
      <button
        type="button"
        onClick={dec}
        aria-label={`Fewer ${label}`}
        disabled={value <= 0}
        className="w-7 h-7 rounded-md border border-paper-400 bg-white text-ink-700 hover:bg-paper-200 disabled:opacity-40 disabled:cursor-default flex items-center justify-center font-sans text-sm leading-none"
      >
        −
      </button>
      <span className="font-mono text-sm tabular-nums text-ink-900 w-7 text-center [font-feature-settings:'tnum']">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        aria-label={`More ${label}`}
        disabled={value >= 50}
        className="w-7 h-7 rounded-md border border-paper-400 bg-white text-ink-700 hover:bg-paper-200 disabled:opacity-40 disabled:cursor-default flex items-center justify-center font-sans text-sm leading-none"
      >
        +
      </button>
      <span className="font-sans text-xs text-ink-500 ml-0.5 hidden sm:inline">
        {label}
      </span>
    </div>
  );
}

function ResolvedRecipeRow({
  recipe,
  onRemove,
}: {
  recipe: RecipeListItem;
  onRemove: () => void;
}) {
  return (
    <>
      <PhotoFrame
        src={recipe.photoUrl}
        alt=""
        ratio="1 / 1"
        radius="sm"
        showCaption={false}
        className="shrink-0 w-12 h-12 print:w-10 print:h-10"
      />
      <div className="min-w-0 flex-1">
        <Link
          to={`/recipes/${recipe.id}`}
          className="font-display font-medium text-md text-ink-900 leading-tight no-underline hover:text-tomato-600 transition-colors duration-100 block truncate"
        >
          {recipe.title}
        </Link>
        <div className="mt-0.5 font-sans text-xs text-ink-500 capitalize truncate">
          {recipe.category}
          {recipe.totalTime && (
            <>
              <span aria-hidden="true" className="text-ink-300">
                {" · "}
              </span>
              <span className="font-mono [font-feature-settings:'tnum']">
                {recipe.totalTime}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${recipe.title}`}
        title="Remove from meal plan"
        className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
      >
        <Icon name="x" size={16} />
      </button>
    </>
  );
}

function UnresolvedRecipeRow({ onRemove }: { onRemove: () => void }) {
  return (
    <>
      <div className="flex-none w-12 h-12 rounded-sm bg-paper-200 flex items-center justify-center text-ink-300">
        <Icon name="image" size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display italic text-md text-ink-500 leading-tight truncate">
          Recipe unavailable
        </div>
        <div className="mt-0.5 font-sans text-xs text-ink-500">
          It may have been deleted or unshared.
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from meal plan"
        title="Remove from meal plan"
        className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
      >
        <Icon name="x" size={16} />
      </button>
    </>
  );
}


function RecipesEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-paper-400 bg-paper-50 px-6 py-8 text-center">
      <p className="font-display italic text-md text-ink-700 m-0">
        No recipes yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-1.5 max-w-[320px] mx-auto">
        Open a recipe and tap{" "}
        <span className="inline-flex items-center gap-1 font-sans font-medium text-ink-700">
          <Icon name="utensils" size={12} /> Add to plan
        </span>{" "}
        to drop it here.
      </p>
    </div>
  );
}
