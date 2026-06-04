import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "../lib/useAuth";
import { useChapters } from "../lib/categories";
import {
  deleteMealPlan,
  duplicateMealPlan,
  newGuestId,
  newPrepId,
  removeRecipeFromMealPlan,
  renameMealPlan,
  updateMealPlanMeta,
  useMealPlan,
} from "../lib/mealPlans";
import { useRecipeList } from "../lib/queryRecipes";
import { trackEvent } from "../lib/analytics";
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
} from "../components/ui";
import { PrepNotesEditor } from "../components/PrepNotesEditor";
import { ShareMealPlanDialog } from "../components/ShareMealPlanDialog";

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
  const { chapters } = useChapters(user?.uid);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  // Duplicate-plan dialog state. Open is controlled here; name +
  // error live alongside so the inline form keeps its own scratch.
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  // Share-plan dialog state. The dialog reads + writes the plan's
  // sharedWithDetails list via the callable; on success we
  // optimistically reflect changes locally so the dialog re-renders
  // immediately without waiting for the Firestore snapshot to round-trip.
  const [shareOpen, setShareOpen] = useState(false);
  const [optimisticSharedWithDetails, setOptimisticSharedWithDetails] =
    useState<{ uid: string; email: string }[] | null>(null);

  // Collapsible section state. Default expanded so first-time users
  // see the affordances; click on the section header to collapse. We
  // intentionally don't persist this across reloads — the page is
  // short enough that the user's preference doesn't outweigh the
  // discovery benefit of arriving at a fully-laid-out plan.
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(true);

  // Local guest state with debounced save — the dialog-style "save when
  // the user pauses typing" pattern keeps every keystroke from hitting
  // Firestore while still feeling immediate. Notes use the same trick.
  const [guests, setGuests] = useState<GuestGroup[]>([]);
  const [notes, setNotes] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);
  const [date, setDate] = useState("");
  const guestsHydratedRef = useRef(false);
  const notesHydratedRef = useRef(false);
  const prepHydratedRef = useRef(false);
  const additionalHydratedRef = useRef(false);
  const dateHydratedRef = useRef(false);
  const dateDirtyRef = useRef(false);

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
    if (!dateHydratedRef.current) {
      setDate(plan.date ?? "");
      dateHydratedRef.current = true;
    }
  }, [plan]);

  // Debounced saves — wait until the user stops editing for 600ms
  // before writing. The cleanup cancels the pending save on the next
  // edit, so rapid typing only fires one Firestore write at the end.
  const guestsDirtyRef = useRef(false);
  useEffect(() => {
    if (!plan || !id || plan.access !== "owned") return;
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
    if (!plan || !id || plan.access !== "owned") return;
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
    if (!plan || !id || plan.access !== "owned") return;
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
    if (!plan || !id || plan.access !== "owned") return;
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

  useEffect(() => {
    if (!plan || !id || plan.access !== "owned") return;
    if (!dateHydratedRef.current) return;
    if (!dateDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void updateMealPlanMeta(id, { date }).catch((err) => {
        console.error("Save date:", err);
        toast.show("Couldn't save date.");
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [date, id, plan, toast]);

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

  // Owner gating for Edit / Share / Duplicate / Delete / inline rename.
  // Non-owners see a read-only view: just the menu, prep list, and
  // notes, with no chrome to mutate anything. Firestore rules already
  // enforce this server-side; the UI gates are just for clarity.
  const isOwner = plan.access === "owned";
  // The dialog reads the optimistic snapshot if there's one (post-add
  // / post-remove), otherwise falls back to whatever the live plan
  // doc currently has — that's the source of truth for sharing state.
  const sharedWithDetailsForDialog =
    optimisticSharedWithDetails ?? plan.sharedWithDetails;

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

  async function handleDuplicate() {
    if (!plan || !user) return;
    if (!duplicateName.trim()) return;
    setDuplicating(true);
    setDuplicateError(null);
    try {
      const newId = await duplicateMealPlan(plan, duplicateName, user.uid);
      trackEvent("meal_plan_duplicated", {
        carried_recipes: plan.recipeIds.length,
        carried_items: plan.additionalItems.length,
      });
      setDuplicateOpen(false);
      setDuplicateName("");
      toast.show(`Created "${duplicateName.trim()}"`);
      navigate(`/meal-plans/${newId}`, { replace: false });
    } catch (err) {
      console.error("Duplicate meal plan:", err);
      setDuplicateError(
        err instanceof Error ? err.message : "Couldn't duplicate plan.",
      );
    } finally {
      setDuplicating(false);
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
  // guest is bringing). Each item is bucketed into a chapter so it
  // shows up beside recipes in the same chapter group. The chapter
  // argument pre-fills that slot so the new row lands where the user
  // is looking.
  function addAdditionalItem(chapter?: string) {
    additionalDirtyRef.current = true;
    setAdditionalItems((prev) => [
      ...prev,
      { id: newPrepId(), name: "", broughtBy: undefined, chapter },
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
    trackEvent("meal_plan_printed", {
      recipe_count: plan?.recipeIds.length ?? 0,
      additional_item_count: plan?.additionalItems.length ?? 0,
    });
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
          {/*
            Share / Duplicate / Delete are owner-only. A grantee viewer
            keeps Grocery list (their own derived view) and Print (a
            personal action), but mutating actions disappear so the
            page reads as a clean read-only surface. The server-side
            firestore.rules enforces ownership too — this is just
            front-end gating for a tidy UI.
          */}
          {isOwner && (
            <Button
              type="button"
              variant="secondary"
              icon="share-2"
              size="sm"
              onClick={() => {
                setOptimisticSharedWithDetails(null);
                setShareOpen(true);
              }}
              aria-label="Share"
            >
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}
          {isOwner && (
            <Button
              type="button"
              variant="secondary"
              icon="copy"
              size="sm"
              onClick={() => {
                // Pre-fill with "(copy)" so the user can either accept
                // it or replace the whole name. Reset error state.
                setDuplicateName(`${plan.name} (copy)`);
                setDuplicateError(null);
                setDuplicateOpen(true);
              }}
              aria-label="Duplicate"
            >
              <span className="hidden sm:inline">Duplicate</span>
            </Button>
          )}
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
          {isOwner && (
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
          )}
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
      ) : isOwner ? (
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
      ) : (
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.02em] text-ink-900 m-0">
          {plan.name}
        </h1>
      )}

      {/* Event date — auto-saves on change, clears on empty.
          Styled like Select so it visually pairs with other dropdowns. */}
      <div className="mt-2 relative w-full sm:max-w-xs print:hidden">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            dateDirtyRef.current = true;
            setDate(e.target.value);
          }}
          className={[
            "w-full font-sans text-sm bg-white",
            "border border-paper-400 rounded-md pl-3 pr-9 py-2.5",
            "outline-none appearance-none transition-colors duration-100 cursor-pointer",
            "focus:border-tomato-500 focus:shadow-[var(--shadow-focus)]",
            date ? "text-ink-900" : "text-ink-400",
          ].join(" ")}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
        >
          <Icon name="chevron-down" size={16} />
        </span>
      </div>
      {date && (
        <p className="hidden print:block font-sans text-sm text-ink-500 mt-1 mb-0">
          {formatEventDate(date)}
        </p>
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

      {/*
        Whole section is `print:hidden`. The meta line under the title
        ("X adults, Y kids · Z recipes") already shows the headline
        guest count — the section adds no information on paper, and
        the CollapsibleSection's grid panel was leaving ~60% of page 1
        as blank space because the force-open print rule kept the row
        claiming `1fr` of vertical room even when the family rows were
        hidden inside it. Hiding the wrapper removes that footprint
        entirely so Menu can start on page 1.
      */}
      <div className="mb-8 print:hidden">
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
          {/*
            On print we only want the summary chip in the section
            header ("3 adults, 2 kids") — the per-family edit rows
            are noise on paper. Wrap the panel content in
            `print:hidden` so the families list disappears in the
            printed view while staying interactive on screen.
          */}
          <div className="print:hidden">
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
                    <Input
                      value={g.name}
                      onChange={(e) =>
                        updateFamily(i, { name: e.target.value })
                      }
                      placeholder="McMullen Family"
                      className="flex-1 min-w-[180px]"
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
                    <button
                      type="button"
                      onClick={() => removeFamily(i)}
                      aria-label={`Remove ${g.name || "family"}`}
                      className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CollapsibleSection>
      </div>

      <MenuSection
        chapters={chapters}
        recipeIds={plan.recipeIds}
        recipesById={recipesById}
        additionalItems={additionalItems}
        onRemoveRecipe={handleRemoveRecipe}
        onAddItemInChapter={(chapter) => addAdditionalItem(chapter)}
        onUpdateItem={updateAdditionalItem}
        onRemoveItem={removeAdditionalItem}
        onCreateChapter={async (name) => {
          // Plan-local header — does NOT write to the user's chapter
          // library. We just seed a blank additional item carrying
          // the typed chapter slug, and the menu picks up any
          // chapter mentioned by additional items (see the grouping
          // useMemo). The user can put dessert items the guest is
          // bringing under a "Dessert" header without having to
          // create a Dessert chapter in their library.
          const normalized = name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
          if (!normalized) throw new Error("Header cannot be empty.");
          if (normalized.length > 100)
            throw new Error("Header is too long.");
          addAdditionalItem(normalized);
        }}
      />

      {/*
        prep-list-wrapper carries the page break for print. We put it
        on the OUTER div (not just on the CollapsibleSection itself)
        because some browsers' print engines refuse to honor
        page-break-before on deeper elements, especially ones inside
        grid containers (the collapsible panel uses display:grid).
      */}
      <div className="mt-8 prep-list-wrapper">
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
      <section className="mt-8 notes-section">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3">
          Notes
        </h2>
        {/*
          Notes shares the prep-list markdown experience: Write /
          Preview tabs, formatting toolbar, multi-level lists,
          interactive task checkboxes. We use the same component +
          className so the print CSS scoped to .prep-notes-preview
          and the toolbar styles apply here without duplication.
          The dirty-ref pattern matches the rest of the page — any
          change marks dirty, the debounced effect picks it up.
        */}
        <PrepNotesEditor
          value={notes}
          onChange={(next) => {
            notesDirtyRef.current = true;
            setNotes(next);
          }}
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

      <DuplicatePlanDialog
        open={duplicateOpen}
        sourceName={plan.name}
        name={duplicateName}
        onNameChange={setDuplicateName}
        error={duplicateError}
        busy={duplicating}
        onCancel={() => setDuplicateOpen(false)}
        onConfirm={handleDuplicate}
      />

      {isOwner && id && (
        <ShareMealPlanDialog
          open={shareOpen}
          planId={id}
          planName={plan.name}
          sharedWithDetails={sharedWithDetailsForDialog}
          onClose={() => setShareOpen(false)}
          onChange={(next) => setOptimisticSharedWithDetails(next)}
        />
      )}
    </article>
  );
}

interface DuplicatePlanDialogProps {
  open: boolean;
  sourceName: string;
  name: string;
  onNameChange: (next: string) => void;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Native <dialog> for naming the duplicate. Same focus-trap / Esc-dismiss
 * machinery as ConfirmDialog and ShareDialog, but with an input + a
 * helper line that calls out what carries over and what gets cleared so
 * the user isn't surprised when their new plan opens empty of guests.
 *
 * The form uses method="dialog" + a submit-typed primary button so
 * Enter inside the input commits without us wiring a keydown handler,
 * and the autoFocus on the confirm button matches the pattern from the
 * Tag merge dialog (so Enter from any focused control still fires the
 * primary action).
 */
function DuplicatePlanDialog({
  open,
  sourceName,
  name,
  onNameChange,
  error,
  busy,
  onCancel,
  onConfirm,
}: DuplicatePlanDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className={[
        "m-auto p-0 bg-transparent border-0",
        "backdrop:bg-ink-900/50",
      ].join(" ")}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          onConfirm();
        }}
        className="bg-white rounded-xl shadow-lg p-6 max-w-[440px] w-[92vw]"
      >
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-2 leading-snug">
          Duplicate meal plan
        </h2>
        <p className="font-sans text-sm leading-relaxed text-ink-700 m-0 mb-4">
          Make a copy of <strong>{sourceName}</strong> to start a new
          plan for a different occasion.
        </p>
        <label className="block font-sans text-sm font-semibold text-ink-700 mb-1.5">
          New plan name
        </label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Thanksgiving 2026"
        />
        <p className="mt-3 font-sans text-xs text-ink-500 leading-relaxed">
          Recipes, additional items, prep list, and notes carry over.
          Guests and date are cleared so each occasion starts fresh.
        </p>
        {error && (
          <p className="mt-2 font-sans text-xs text-tomato-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            autoFocus
            disabled={busy || !name.trim()}
          >
            {busy ? "Duplicating…" : "Duplicate"}
          </Button>
        </div>
      </form>
    </dialog>
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
 * progress with the section collapsed. Returns "" when there's
 * content but no tasks — the CollapsibleSection skips an empty chip,
 * which avoids the confusing "Prep list Notes" double-label since
 * the page also has a top-level Notes section.
 */
function formatEventDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function prepMarkdownSummary(md: string): string {
  if (!md.trim()) return "";
  const taskOpen = (md.match(/^[\s]*[-*]\s\[\s\]/gm) ?? []).length;
  const taskDone = (md.match(/^[\s]*[-*]\s\[[xX]\]/gm) ?? []).length;
  const total = taskOpen + taskDone;
  if (total === 0) return "";
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
      <span className="font-sans text-xs text-ink-500 ml-0.5">
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
        Nothing on the menu yet.
      </p>
      <p className="font-sans text-sm text-ink-500 mt-1.5 max-w-[360px] mx-auto">
        Open a recipe and tap{" "}
        <span className="inline-flex items-center gap-1 font-sans font-medium text-ink-700">
          <Icon name="utensils" size={12} /> Add to plan
        </span>
        , or use &ldquo;Add item&rdquo; on any chapter to track a
        non-recipe item like crudité, wine, or dessert from the bakery.
      </p>
    </div>
  );
}

interface MenuSectionProps {
  chapters: string[];
  recipeIds: string[];
  recipesById: Map<string, RecipeListItem>;
  additionalItems: AdditionalItem[];
  onRemoveRecipe: (recipeId: string) => void;
  onAddItemInChapter: (chapter: string | undefined) => void;
  onUpdateItem: (idx: number, patch: Partial<AdditionalItem>) => void;
  onRemoveItem: (idx: number) => void;
  /**
   * Persist a new chapter to the user's chapter library, then bring
   * it into the menu (typically by seeding a placeholder item).
   * Throws on validation / network errors so the inline form can
   * surface them next to the input.
   */
  onCreateChapter: (name: string) => Promise<void>;
}

/**
 * Unified menu — recipes and additional items grouped by chapter.
 *
 * For each chapter in the user's ordered chapter list, we collect
 * every recipe whose `category` matches (case-insensitive) and every
 * additional item whose `chapter` matches. Orphan content — recipes
 * with a category the user doesn't have, or items with no chapter at
 * all — falls into a final "Other" group so nothing gets hidden.
 *
 * Recipes render as the existing photo+title row; non-recipe items
 * render as inline-editable rows (name + brought-by + remove). The
 * "Add item" button on each chapter pre-fills that chapter so the
 * new item lands in the section the user is looking at.
 */
function MenuSection({
  chapters,
  recipeIds,
  recipesById,
  additionalItems,
  onRemoveRecipe,
  onAddItemInChapter,
  onUpdateItem,
  onRemoveItem,
  onCreateChapter,
}: MenuSectionProps) {
  // Inline "new chapter" form state. Kept local because it's pure
  // chrome — the parent only sees the committed name.
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  async function handleCreateChapter() {
    const trimmed = newChapterName.trim();
    if (!trimmed) return;
    setCreatingChapter(true);
    setChapterError(null);
    try {
      await onCreateChapter(trimmed);
      setNewChapterName("");
      setIsAddingChapter(false);
    } catch (err) {
      // Surface "Chapter X already exists" and similar — the addChapter
      // helper throws Error with a user-readable message.
      setChapterError(
        err instanceof Error ? err.message : "Couldn't add chapter.",
      );
    } finally {
      setCreatingChapter(false);
    }
  }

  function cancelAddChapter() {
    setIsAddingChapter(false);
    setNewChapterName("");
    setChapterError(null);
  }
  // Build the grouping. We track the original index of each
  // additional item so update/remove callbacks can reach back into
  // the parent state array. Recipes keep their own order from
  // recipeIds.
  //
  // Chapter precedence:
  //   1. Recipe categories that match a library chapter render in
  //      that chapter's slot, in the user's chapter order.
  //   2. Additional items can carry a `chapter` that ISN'T in the
  //      library — those become plan-local headers. We track the
  //      ORDER they first appear in `additionalItems` so headers
  //      stay where the user put them.
  //   3. Truly chapter-less items (and recipes whose category isn't
  //      in the library OR mentioned by any item) fall into "Other"
  //      at the very bottom.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { recipes: string[]; items: { item: AdditionalItem; idx: number }[] }
    >();
    const ensure = (key: string) => {
      let g = map.get(key);
      if (!g) {
        g = { recipes: [], items: [] };
        map.set(key, g);
      }
      return g;
    };

    const libraryChapters = new Set(chapters.map((c) => c.toLowerCase()));

    // First pass: collect every chapter slug mentioned by an item,
    // in the order it first shows up. These are the plan-local
    // headers ("Dessert" when the user has no Dessert chapter, etc).
    const planLocalOrder: string[] = [];
    const planLocalSeen = new Set<string>();
    for (const item of additionalItems) {
      const key = item.chapter?.toLowerCase() ?? "";
      if (!key) continue;
      if (libraryChapters.has(key)) continue;
      if (planLocalSeen.has(key)) continue;
      planLocalSeen.add(key);
      planLocalOrder.push(key);
    }
    const allKnownChapters = new Set<string>([
      ...libraryChapters,
      ...planLocalOrder,
    ]);

    for (const rid of recipeIds) {
      const recipe = recipesById.get(rid);
      const key = recipe?.category?.toLowerCase() ?? "";
      const target = key && allKnownChapters.has(key) ? key : "__other__";
      ensure(target).recipes.push(rid);
    }
    additionalItems.forEach((item, idx) => {
      const key = item.chapter?.toLowerCase() ?? "";
      const target = key && allKnownChapters.has(key) ? key : "__other__";
      ensure(target).items.push({ item, idx });
    });

    const ordered: {
      key: string;
      // Display label — library chapters keep the user's preferred
      // casing ("Entrée"), plan-local ones display as the slug the
      // user typed (the slug IS the display name for those).
      label: string;
      // The exact chapter slug to pass back when the user adds an
      // item in this group (undefined for the Other bucket so the
      // item's chapter field stays empty rather than being pinned to
      // a synthetic slug).
      addChapter: string | undefined;
      // True for plan-local headers — used by ChapterGroup to render
      // a slightly muted heading so the user can tell at a glance
      // which chapters belong to their library.
      isLocal: boolean;
      recipes: string[];
      items: { item: AdditionalItem; idx: number }[];
    }[] = [];

    for (const c of chapters) {
      const g = map.get(c.toLowerCase());
      if (!g || (g.recipes.length === 0 && g.items.length === 0)) continue;
      ordered.push({
        key: c.toLowerCase(),
        label: c,
        addChapter: c,
        isLocal: false,
        recipes: g.recipes,
        items: g.items,
      });
    }
    for (const key of planLocalOrder) {
      const g = map.get(key);
      if (!g || (g.recipes.length === 0 && g.items.length === 0)) continue;
      ordered.push({
        key,
        label: key,
        addChapter: key,
        isLocal: true,
        recipes: g.recipes,
        items: g.items,
      });
    }
    const other = map.get("__other__");
    if (other && (other.recipes.length > 0 || other.items.length > 0)) {
      ordered.push({
        key: "__other__",
        label: "Other",
        addChapter: undefined,
        isLocal: false,
        recipes: other.recipes,
        items: other.items,
      });
    }
    return ordered;
  }, [chapters, recipeIds, recipesById, additionalItems]);

  const isEmpty = groups.length === 0;

  return (
    <section className="menu-section">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0">
          Menu
        </h2>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            type="button"
            variant="secondary"
            icon="plus"
            size="sm"
            onClick={() => {
              setIsAddingChapter(true);
              setNewChapterName("");
              setChapterError(null);
            }}
            disabled={isAddingChapter}
          >
            Add header
          </Button>
          <Link to="/" className="no-underline">
            <Button type="button" variant="secondary" size="sm" icon="plus">
              <span className="sm:hidden">Recipes</span>
              <span className="hidden sm:inline">Browse recipes</span>
            </Button>
          </Link>
        </div>
      </div>

      {isAddingChapter && (
        <div className="mb-4 rounded-lg border border-[var(--border-faint)] bg-paper-50 p-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input
              value={newChapterName}
              autoFocus
              onChange={(e) => setNewChapterName(e.target.value)}
              placeholder="Dessert, drinks, kids' table…"
              className="flex-1 min-w-[160px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateChapter();
                } else if (e.key === "Escape") {
                  cancelAddChapter();
                }
              }}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreateChapter}
              disabled={creatingChapter || !newChapterName.trim()}
            >
              {creatingChapter ? "Adding…" : "Add header"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelAddChapter}
              disabled={creatingChapter}
            >
              Cancel
            </Button>
          </div>
          {chapterError && (
            <p className="mt-2 font-sans text-xs text-tomato-700">
              {chapterError}
            </p>
          )}
          <p className="mt-2 font-sans text-xs text-ink-500">
            Just for this plan — doesn&rsquo;t touch your chapter
            library. A blank item appears under the new header,
            ready to fill in.
          </p>
        </div>
      )}

      {isEmpty && !isAddingChapter ? (
        <RecipesEmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <ChapterGroup
              key={g.key}
              label={g.label}
              isOther={g.key === "__other__"}
              recipeIds={g.recipes}
              recipesById={recipesById}
              items={g.items}
              onRemoveRecipe={onRemoveRecipe}
              onAddItem={() => onAddItemInChapter(g.addChapter)}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface ChapterGroupProps {
  label: string;
  isOther: boolean;
  recipeIds: string[];
  recipesById: Map<string, RecipeListItem>;
  items: { item: AdditionalItem; idx: number }[];
  onRemoveRecipe: (recipeId: string) => void;
  onAddItem: () => void;
  onUpdateItem: (idx: number, patch: Partial<AdditionalItem>) => void;
  onRemoveItem: (idx: number) => void;
}

/**
 * One chapter heading + its recipes + its additional items + an
 * "Add item" button. The chapter heading uses CSS capitalize for
 * the same reason the home view does — chapter slugs are stored
 * lowercase so "entree" prints as "Entree" without per-call casing.
 */
function ChapterGroup({
  label,
  isOther,
  recipeIds,
  recipesById,
  items,
  onRemoveRecipe,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: ChapterGroupProps) {
  const totalRows = recipeIds.length + items.length;
  return (
    <div className="menu-chapter">
      <div className="flex items-baseline gap-2 border-b border-paper-300 pb-1.5 mb-2">
        <h3
          className={[
            "font-display text-lg font-medium m-0 leading-tight",
            isOther
              ? "italic text-ink-500"
              : "capitalize text-ink-900",
          ].join(" ")}
        >
          {label}
        </h3>
        <span className="font-mono text-xs text-ink-300 [font-feature-settings:'tnum']">
          {totalRows}
        </span>
        <span className="ml-auto print:hidden">
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-tomato-600 hover:text-tomato-700"
          >
            <Icon name="plus" size={12} /> Add item
          </button>
        </span>
      </div>
      <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
        {recipeIds.map((rid, i) => {
          const recipe = recipesById.get(rid);
          const isLastRow = i === recipeIds.length - 1 && items.length === 0;
          return (
            <li
              key={rid}
              className={[
                "flex items-center gap-3 px-3.5 py-3",
                isLastRow ? "" : "border-b border-[var(--border-faint)]",
              ].join(" ")}
            >
              {recipe ? (
                <ResolvedRecipeRow
                  recipe={recipe}
                  onRemove={() => onRemoveRecipe(rid)}
                />
              ) : (
                <UnresolvedRecipeRow
                  onRemove={() => onRemoveRecipe(rid)}
                />
              )}
            </li>
          );
        })}
        {items.map(({ item, idx }, i) => {
          const isLast = i === items.length - 1;
          return (
            <li
              key={item.id}
              className={[
                "menu-item-row flex items-center gap-2 px-3.5 py-2.5",
                isLast ? "" : "border-b border-[var(--border-faint)]",
              ].join(" ")}
            >
              {/* Screen-only editor inputs — stacked on mobile, inline on sm+. */}
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 print:hidden">
                <Input
                  value={item.name}
                  onChange={(e) =>
                    onUpdateItem(idx, { name: e.target.value })
                  }
                  placeholder="Crudité, wine, dessert…"
                  className="flex-1"
                />
                <Input
                  value={item.broughtBy ?? ""}
                  onChange={(e) =>
                    onUpdateItem(idx, {
                      broughtBy: e.target.value || undefined,
                    })
                  }
                  placeholder="Brought by…"
                  className="sm:w-36 sm:shrink-0"
                />
              </div>
              {/* Print-only flat string. */}
              <span className="hidden print:inline font-sans flex-1">
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
                onClick={() => onRemoveItem(idx)}
                aria-label={`Remove ${item.name || "additional item"}`}
                title="Remove"
                className="flex-none p-1.5 rounded text-ink-400 hover:text-tomato-700 hover:bg-tomato-50 transition-colors duration-100 print:hidden"
              >
                <Icon name="x" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
