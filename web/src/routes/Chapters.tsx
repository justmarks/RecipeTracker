import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../lib/useAuth";
import {
  addChapter,
  deleteChapter,
  moveChapter,
  reorderChapters,
  renameChapter,
  useChapters,
} from "../lib/categories";
import { Button, ConfirmDialog, Icon, Input } from "../components/ui";
import { trackEvent } from "../lib/analytics";

/**
 * Chapters management — list as a single card with paper-faint
 * dividers between rows. Each row has a drag handle for reordering,
 * up/down arrow buttons (keyboard/accessibility fallback), the
 * capitalized chapter name (click to rename inline), and an icon-only
 * trash button. Add-a-chapter form sits below the card.
 */
export function Chapters() {
  const { user, loading: authLoading } = useAuth();
  const { chapters, loading } = useChapters(user?.uid);
  const navigate = useNavigate();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingChapter, setRenamingChapter] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyChapter, setBusyChapter] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);

  // DnD state
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Refs to keep startDrag's closure fresh without re-creating the callback.
  const chaptersRef = useRef(chapters);
  const userRef = useRef(user);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Ref to the <ul> so we can read its top offset each pointermove
  // (handles page scrolling mid-drag) and measure a representative row
  // height once at drag start.
  const ulRef = useRef<HTMLUListElement | null>(null);

  // Row height captured at drag start. We use uniform-height slot
  // hit-testing rather than per-row bounding-rect checks so the drop
  // target stays stable as rows visually rearrange during the drag.
  // If we hit-tested per-row, every reorder would shift rects under
  // the pointer and trigger oscillation.
  const dragMetricsRef = useRef<{ rowHeight: number } | null>(null);

  // Stores the cleanup fn for outstanding drag listeners so unmount is safe.
  const cleanupDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { cleanupDragRef.current?.(); }, []);

  // Stable callback — uses only refs internally so dep array is empty.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startDrag = useCallback((startIdx: number) => {
    const ul = ulRef.current;
    const firstRow = ul?.firstElementChild as HTMLElement | null;
    // Defensive fallback: 56px matches the row's actual height (gap-3
    // px-4 py-3.5 with 16px line-height content). Without this, the
    // very first drag on a freshly-rendered list could divide by NaN.
    const rowHeight = firstRow?.getBoundingClientRect().height ?? 56;
    dragMetricsRef.current = { rowHeight };

    setDraggingIdx(startIdx);
    setDragOverIdx(startIdx);

    let currentOverIdx = startIdx;

    function onMove(e: PointerEvent) {
      const ulEl = ulRef.current;
      const metrics = dragMetricsRef.current;
      if (!ulEl || !metrics) return;
      // Re-read listTop each frame so page scroll during drag still works.
      const listTop = ulEl.getBoundingClientRect().top;
      const relativeY = e.clientY - listTop;
      const slot = Math.max(
        0,
        Math.min(
          chaptersRef.current.length - 1,
          Math.floor(relativeY / metrics.rowHeight),
        ),
      );
      if (slot !== currentOverIdx) {
        currentOverIdx = slot;
        setDragOverIdx(slot);
      }
    }

    function onUp() {
      cleanup();
      setDraggingIdx(null);
      setDragOverIdx(null);
      dragMetricsRef.current = null;

      const uid = userRef.current?.uid;
      if (!uid || currentOverIdx === startIdx) return;

      const current = chaptersRef.current;
      const newOrder = [...current];
      const [item] = newOrder.splice(startIdx, 1);
      newOrder.splice(currentOverIdx, 0, item);

      setError(null);
      reorderChapters(uid, newOrder).catch((err) => {
        setError(err instanceof Error ? err.message : "Reorder failed.");
      });
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cleanupDragRef.current = null;
    }

    cleanupDragRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // All hooks must be above these early returns.
  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function withBusy<T>(
    chapter: string | null,
    op: () => Promise<T>,
  ): Promise<T | null> {
    setError(null);
    setBusyChapter(chapter);
    try {
      return await op();
    } catch (err) {
      console.error("Chapter op:", err);
      setError(err instanceof Error ? err.message : "Operation failed.");
      return null;
    } finally {
      setBusyChapter(null);
    }
  }

  // Pop the previous in-app entry if there is one (so Back from
  // Chapters returns to whoever sent you here — Account on mobile,
  // wherever-you-clicked-Manage-chapters on desktop). Falls back to
  // home for direct URL loads where there's no history to pop.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  async function handleAdd() {
    if (!user || !newName.trim()) return;
    setAdding(true);
    const result = await withBusy(null, () => addChapter(user.uid, newName));
    setAdding(false);
    if (result !== null) {
      trackEvent("chapter_created");
      // Close the inline add-row on success. If the user wants to add
      // another chapter, they click "Add chapter" again — clearer than
      // leaving an empty row sitting there.
      setNewName("");
      setIsAddingChapter(false);
    }
  }

  function openAddChapter() {
    setNewName("");
    setIsAddingChapter(true);
    setError(null);
  }

  function cancelAddChapter() {
    setIsAddingChapter(false);
    setNewName("");
  }

  async function handleRename(oldName: string) {
    if (!user || !renameValue.trim()) return;
    const result = await withBusy(oldName, () =>
      renameChapter(user.uid, oldName, renameValue),
    );
    if (result !== null) {
      setRenamingChapter(null);
      setRenameValue("");
    }
  }

  async function handleDeleteConfirmed() {
    if (!user || !confirmDeleteName) return;
    const name = confirmDeleteName;
    setConfirmDeleteName(null);
    await withBusy(name, () => deleteChapter(user.uid, name));
  }

  async function handleMove(name: string, direction: "up" | "down") {
    if (!user) return;
    await withBusy(name, () => moveChapter(user.uid, name, direction));
  }

  const isDragging = draggingIdx !== null;

  // While dragging, render the list in its previewed post-drop order so
  // the user sees the rearrangement happening live. When not dragging
  // (or when the dragged item is "over" its own original slot), this
  // is the same as `chapters`.
  const displayOrder = useMemo(() => {
    if (draggingIdx === null || dragOverIdx === null) return chapters;
    if (draggingIdx === dragOverIdx) return chapters;
    const arr = [...chapters];
    const [item] = arr.splice(draggingIdx, 1);
    arr.splice(dragOverIdx, 0, item);
    return arr;
  }, [chapters, draggingIdx, dragOverIdx]);

  return (
    <div className="mx-auto max-w-[640px] px-6 py-8 lg:px-10 lg:py-10">
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
          Chapters
        </h1>
        <Button
          type="button"
          variant="primary"
          icon="plus"
          size="sm"
          onClick={openAddChapter}
          disabled={isAddingChapter}
        >
          <span className="hidden sm:inline">Add chapter</span>
        </Button>
      </div>
      <p className="font-sans text-sm text-ink-700 m-0 mb-6 max-w-[440px]">
        Chapters group your recipes like sections in a cookbook. Click a name
        to rename, drag to reorder — recipes in renamed chapters move with
        them.
      </p>

      {loading ? (
        <p className="font-sans text-sm text-ink-500">Loading…</p>
      ) : chapters.length === 0 && !isAddingChapter ? (
        <p className="font-sans text-sm text-ink-500">
          No chapters yet. Click &ldquo;Add chapter&rdquo; to create one.
        </p>
      ) : (
        <ul
          ref={ulRef}
          className={[
            "list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden",
            isDragging ? "select-none" : "",
          ].join(" ")}
        >
          {displayOrder.map((chapter, visualIdx) => {
            // Iterate displayOrder (which is `chapters` reordered to
            // show the drag preview), but resolve the original chapter
            // index for handlers that operate on the source array.
            const originalIdx = chapters.indexOf(chapter);
            const isRenaming = renamingChapter === chapter;
            const isBusy = busyChapter === chapter;
            // "Last" loses its bottom border when the inline add-row is
            // appended below, otherwise it'd double up with the add-row's
            // top border. Uses visualIdx because the visual ordering
            // determines what looks last.
            const isLast =
              visualIdx === displayOrder.length - 1 && !isAddingChapter;
            const isBeingDragged = originalIdx === draggingIdx;

            return (
              <li
                key={chapter}
                className={[
                  "flex items-center gap-3 px-4 py-3.5 transition-colors duration-100",
                  isLast ? "" : "border-b border-[var(--border-faint)]",
                  // The dragged row pops visually so the user can track
                  // it as it moves into its previewed slot. Rearrangement
                  // of the surrounding rows IS the drop-target indicator —
                  // no separate highlight needed.
                  isBeingDragged
                    ? "relative z-10 bg-paper-50 shadow-md ring-1 ring-tomato-300/40"
                    : "",
                ].join(" ")}
              >
                {/* Drag handle — touch-action none prevents scroll hijack */}
                <button
                  type="button"
                  aria-label={`Drag to reorder ${chapter}`}
                  disabled={isRenaming || isBusy}
                  onPointerDown={
                    isRenaming || isBusy
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          startDrag(originalIdx);
                        }
                  }
                  className={[
                    "flex-none p-0.5 rounded transition-colors duration-100",
                    isRenaming || isBusy
                      ? "opacity-30 cursor-default text-ink-400"
                      : isBeingDragged
                        ? "cursor-grabbing text-ink-700"
                        : "cursor-grab text-ink-400 hover:text-ink-700",
                  ].join(" ")}
                  style={{ touchAction: "none" }}
                >
                  <Icon name="grip-vertical" size={16} />
                </button>

                <ReorderControls
                  upDisabled={originalIdx === 0 || isBusy || isDragging}
                  downDisabled={
                    originalIdx === chapters.length - 1 ||
                    isBusy ||
                    isDragging
                  }
                  onUp={() => handleMove(chapter, "up")}
                  onDown={() => handleMove(chapter, "down")}
                  ariaName={chapter}
                />

                {isRenaming ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRename(chapter);
                        } else if (e.key === "Escape") {
                          setRenamingChapter(null);
                          setRenameValue("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleRename(chapter)}
                      disabled={isBusy || !renameValue.trim()}
                    >
                      {isBusy ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRenamingChapter(null);
                        setRenameValue("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Chapter name doubles as a rename trigger. Rendered
                        as a button (not a span) so it's keyboard-reachable
                        via Tab + Enter and announced to assistive tech as
                        an interactive control. Hover shows the affordance
                        without screaming about it visually. */}
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingChapter(chapter);
                        setRenameValue(chapter);
                      }}
                      disabled={isBusy || isDragging}
                      aria-label={`Rename ${chapter}`}
                      title="Click to rename"
                      className={[
                        "flex-1 text-left px-2 py-1 -mx-2 -my-1 rounded",
                        "font-sans font-medium text-ink-900 capitalize",
                        "transition-colors duration-100",
                        isBusy || isDragging
                          ? "cursor-default opacity-60"
                          : "cursor-pointer hover:bg-paper-200 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      ].join(" ")}
                    >
                      {chapter}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteName(chapter)}
                      disabled={isBusy || isDragging}
                      aria-label={`Delete ${chapter}`}
                      title="Delete chapter"
                      className={[
                        "flex-none p-1.5 rounded transition-colors duration-100",
                        isBusy || isDragging
                          ? "text-ink-300 cursor-default"
                          : "text-ink-400 hover:text-tomato-700 hover:bg-tomato-50",
                        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      ].join(" ")}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </>
                )}
              </li>
            );
          })}

          {isAddingChapter && (
            <li className="flex items-center gap-2 px-4 py-3.5 bg-paper-50">
              <Input
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Chapter name"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  } else if (e.key === "Escape") {
                    cancelAddChapter();
                  }
                }}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
              >
                {adding ? "Adding…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelAddChapter}
                disabled={adding}
              >
                Cancel
              </Button>
            </li>
          )}
        </ul>
      )}

      {error && (
        <div className="mt-4 rounded-md px-4 py-3 text-sm bg-tomato-50 text-tomato-700 border border-tomato-100">
          {error}
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteName !== null}
        title="Delete chapter?"
        message={
          confirmDeleteName
            ? `"${confirmDeleteName}" will be removed from your cookbook. Any recipes still in it will move to the "Uncategorized" chapter (created automatically if it doesn't exist yet).`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setConfirmDeleteName(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

interface ReorderControlsProps {
  upDisabled: boolean;
  downDisabled: boolean;
  onUp: () => void;
  onDown: () => void;
  ariaName: string;
}

function ReorderControls({
  upDisabled,
  downDisabled,
  onUp,
  onDown,
  ariaName,
}: ReorderControlsProps) {
  const btn =
    "p-0.5 text-ink-500 hover:text-ink-900 disabled:opacity-30 disabled:cursor-default transition-colors duration-100";
  return (
    <div className="flex flex-col items-center -my-1">
      <button
        type="button"
        onClick={onUp}
        disabled={upDisabled}
        className={btn}
        aria-label={`Move ${ariaName} up`}
      >
        <Icon name="chevron-up" size={14} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={downDisabled}
        className={btn}
        aria-label={`Move ${ariaName} down`}
      >
        <Icon name="chevron-down" size={14} />
      </button>
    </div>
  );
}
