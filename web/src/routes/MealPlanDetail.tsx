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
import type { Guest, PrepItem, PrepSection } from "shared";
import {
  Button,
  ConfirmDialog,
  Eyebrow,
  Icon,
  Input,
  PhotoFrame,
  SprigDivider,
  Textarea,
} from "../components/ui";

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

  // Local guest state with debounced save — the dialog-style "save when
  // the user pauses typing" pattern keeps every keystroke from hitting
  // Firestore while still feeling immediate. Notes use the same trick.
  const [guests, setGuests] = useState<Guest[]>([]);
  const [notes, setNotes] = useState("");
  const [prepSections, setPrepSections] = useState<PrepSection[]>([]);
  const guestsHydratedRef = useRef(false);
  const notesHydratedRef = useRef(false);
  const prepHydratedRef = useRef(false);

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
      setPrepSections(plan.prepSections);
      prepHydratedRef.current = true;
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
      void updateMealPlanMeta(id, { prepSections }).catch((err) => {
        console.error("Save prep:", err);
        toast.show("Couldn't save prep list.");
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [prepSections, id, plan, toast]);

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

  const adultCount = guests.filter((g) => g.type === "adult").length;
  const childCount = guests.filter((g) => g.type === "child").length;

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

  function addGuest(type: Guest["type"]) {
    guestsDirtyRef.current = true;
    setGuests((prev) => [
      ...prev,
      { id: newGuestId(), name: "", type },
    ]);
  }

  function updateGuest(idx: number, patch: Partial<Guest>) {
    guestsDirtyRef.current = true;
    setGuests((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    );
  }

  function removeGuest(idx: number) {
    guestsDirtyRef.current = true;
    setGuests((prev) => prev.filter((_, i) => i !== idx));
  }

  // Prep list mutations — all mark dirty so the debounced effect picks
  // them up. Operate on whole-array copies (no in-place mutation) so
  // React re-renders cleanly.
  function addPrepSection() {
    prepDirtyRef.current = true;
    setPrepSections((prev) => [
      ...prev,
      { id: newPrepId(), heading: "", items: [] },
    ]);
  }

  function updatePrepHeading(sectionIdx: number, heading: string) {
    prepDirtyRef.current = true;
    setPrepSections((prev) =>
      prev.map((s, i) => (i === sectionIdx ? { ...s, heading } : s)),
    );
  }

  function removePrepSection(sectionIdx: number) {
    prepDirtyRef.current = true;
    setPrepSections((prev) => prev.filter((_, i) => i !== sectionIdx));
  }

  function addPrepItem(sectionIdx: number) {
    prepDirtyRef.current = true;
    setPrepSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              items: [
                ...s.items,
                { id: newPrepId(), text: "", done: false },
              ],
            }
          : s,
      ),
    );
  }

  function updatePrepItem(
    sectionIdx: number,
    itemIdx: number,
    patch: Partial<PrepItem>,
  ) {
    prepDirtyRef.current = true;
    setPrepSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              items: s.items.map((it, j) =>
                j === itemIdx ? { ...it, ...patch } : it,
              ),
            }
          : s,
      ),
    );
  }

  function removePrepItem(sectionIdx: number, itemIdx: number) {
    prepDirtyRef.current = true;
    setPrepSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? { ...s, items: s.items.filter((_, j) => j !== itemIdx) }
          : s,
      ),
    );
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
        {guests.length === 0
          ? "No guests yet."
          : guestSummary(guests.length, adultCount, childCount)}
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

      <section className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-xl font-medium text-ink-900 m-0">
            Guests
          </h2>
          <div className="flex gap-2 print:hidden">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => addGuest("adult")}
            >
              Adult
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => addGuest("child")}
            >
              Kid
            </Button>
          </div>
        </div>

        {guests.length === 0 ? (
          <p className="font-sans text-sm text-ink-500 m-0">
            Add the people you&rsquo;re cooking for so you remember how many
            portions to plan.
          </p>
        ) : (
          <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
            {guests.map((g, i) => (
              <li
                key={g.id}
                className={[
                  "flex items-center gap-2 px-3.5 py-2.5",
                  i === guests.length - 1
                    ? ""
                    : "border-b border-[var(--border-faint)]",
                ].join(" ")}
              >
                <Input
                  value={g.name}
                  onChange={(e) => updateGuest(i, { name: e.target.value })}
                  placeholder={g.type === "adult" ? "Guest name" : "Kid's name"}
                  className="flex-1 print:border-0 print:bg-transparent print:p-0"
                />
                <GuestTypeToggle
                  value={g.type}
                  onChange={(type) => updateGuest(i, { type })}
                />
                <button
                  type="button"
                  onClick={() => removeGuest(i)}
                  aria-label={`Remove ${g.name || "guest"}`}
                  className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
                >
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
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
          placeholder="Menu order, timing, who's bringing what, anything you don't want to forget."
          className="print:border-0 print:bg-transparent print:p-0"
        />
        {!notes && (
          <span className="hidden print:block font-sans text-sm text-ink-500">
            —
          </span>
        )}
      </section>

      <section className="mb-8 prep-list">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-xl font-medium text-ink-900 m-0">
            Prep list
          </h2>
          <div className="print:hidden">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={addPrepSection}
            >
              <span className="hidden sm:inline">Add day</span>
            </Button>
          </div>
        </div>

        {prepSections.length === 0 ? (
          <p className="font-sans text-sm text-ink-500 m-0">
            Tap &ldquo;Add day&rdquo; to start a running checklist —
            sections like &ldquo;Two days before&rdquo; or &ldquo;Day
            of&rdquo; with TODOs you can tick off as you go.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {prepSections.map((section, si) => (
              <PrepSectionBlock
                key={section.id}
                section={section}
                onHeadingChange={(heading) => updatePrepHeading(si, heading)}
                onRemoveSection={() => removePrepSection(si)}
                onAddItem={() => addPrepItem(si)}
                onUpdateItem={(ii, patch) => updatePrepItem(si, ii, patch)}
                onRemoveItem={(ii) => removePrepItem(si, ii)}
              />
            ))}
          </div>
        )}
      </section>

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

function guestSummary(total: number, adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} adult${adults === 1 ? "" : "s"}`);
  if (children > 0)
    parts.push(`${children} kid${children === 1 ? "" : "s"}`);
  if (parts.length === 0) return `${total} guest${total === 1 ? "" : "s"}`;
  return parts.join(" · ");
}

interface GuestTypeToggleProps {
  value: "adult" | "child";
  onChange: (next: "adult" | "child") => void;
}

/**
 * Small segmented control for the adult/kid toggle. Local to this
 * file — the design system doesn't have a generic SegmentedControl
 * primitive yet, and this echoes the URL/Book toggle in RecipeForm.
 */
function GuestTypeToggle({ value, onChange }: GuestTypeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Guest type"
      className="inline-flex rounded-md border border-paper-400 bg-white p-0.5 print:hidden"
    >
      <TypeButton
        active={value === "adult"}
        onClick={() => onChange("adult")}
      >
        Adult
      </TypeButton>
      <TypeButton
        active={value === "child"}
        onClick={() => onChange("child")}
      >
        Kid
      </TypeButton>
    </div>
  );
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        "px-2.5 py-1 rounded text-xs font-sans font-semibold transition-colors duration-100",
        active ? "bg-tomato-500 text-white" : "text-ink-700 hover:bg-paper-200",
      ].join(" ")}
    >
      {children}
    </button>
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

interface PrepSectionBlockProps {
  section: PrepSection;
  onHeadingChange: (heading: string) => void;
  onRemoveSection: () => void;
  onAddItem: () => void;
  onUpdateItem: (idx: number, patch: Partial<PrepItem>) => void;
  onRemoveItem: (idx: number) => void;
}

/**
 * One day-header + checklist block inside the prep list. Heading is
 * an always-editable input (faster than a click-to-rename mode for a
 * scratchpad workflow); items are checkbox + inline input pairs. The
 * × on the section trash icon removes the whole block — items don't
 * each need a confirmation since the prep list is a low-stakes
 * scratch surface, not destructive data.
 */
function PrepSectionBlock({
  section,
  onHeadingChange,
  onRemoveSection,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PrepSectionBlockProps) {
  return (
    <div className="bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--border-faint)] bg-paper-50 prep-section-header">
        <Input
          value={section.heading}
          onChange={(e) => onHeadingChange(e.target.value)}
          placeholder="Day before / Wednesday / Morning of…"
          className="flex-1 font-semibold print:border-0 print:bg-transparent print:p-0"
        />
        <button
          type="button"
          onClick={onRemoveSection}
          aria-label={`Remove section ${section.heading || "untitled"}`}
          title="Remove section"
          className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      <ul className="list-none m-0 p-0 prep-items">
        {section.items.map((item, ii) => (
          <li
            key={item.id}
            className={[
              "flex items-center gap-2 px-3.5 py-2",
              ii === section.items.length - 1
                ? ""
                : "border-b border-[var(--border-faint)]",
            ].join(" ")}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              onClick={() => onUpdateItem(ii, { done: !item.done })}
              title={item.done ? "Mark as not done" : "Mark as done"}
              data-done={item.done ? "true" : "false"}
              className={[
                "flex-none w-5 h-5 rounded border-2 flex items-center justify-center",
                "transition-colors duration-100 cursor-pointer",
                item.done
                  ? "bg-tomato-500 border-tomato-500 text-white"
                  : "bg-white border-paper-400 hover:border-tomato-500 text-transparent",
                "print:border-ink-700 print:text-ink-900",
              ].join(" ")}
            >
              <Icon name="check" size={12} />
            </button>
            <Input
              value={item.text}
              onChange={(e) => onUpdateItem(ii, { text: e.target.value })}
              placeholder="Add a task…"
              className={[
                "flex-1 print:border-0 print:bg-transparent print:p-0",
                item.done ? "line-through text-ink-500" : "",
              ].join(" ")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Enter on a task input adds a new sibling task —
                  // the rapid-fire pattern the user expects from a
                  // checklist editor.
                  e.preventDefault();
                  onAddItem();
                }
              }}
            />
            <button
              type="button"
              onClick={() => onRemoveItem(ii)}
              aria-label="Remove task"
              title="Remove task"
              className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
            >
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="px-3.5 py-2 border-t border-[var(--border-faint)] print:hidden">
        <button
          type="button"
          onClick={onAddItem}
          className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-tomato-600 hover:text-tomato-700"
        >
          <Icon name="plus" size={14} /> Add task
        </button>
      </div>
    </div>
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
