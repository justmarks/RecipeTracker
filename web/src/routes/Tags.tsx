import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../lib/useAuth";
import {
  addTag,
  deleteTag,
  mergeTags,
  normalizeTag,
  renameTag,
  setTagColor,
  useTags,
} from "../lib/tags";
import type { TagSummary } from "../lib/tags";
import {
  Button,
  ConfirmDialog,
  Icon,
  Input,
  Select,
  Tag,
  TAG_SWATCH_CLASSES,
  TAG_TONES,
  tagToneFor,
  type TagTone,
} from "../components/ui";

/**
 * Tag management — symmetric to the Chapters page. Each row shows a
 * color swatch (click to open the palette popover), the tag name (click
 * to rename inline), the recipe count, a merge action, and a trash
 * action. "Add tag" appends an inline row at the bottom of the card.
 *
 * Mutations fan out across every owned recipe that carries the tag —
 * see lib/tags.ts for the Firestore batch math.
 */
export function Tags() {
  const { user, loading: authLoading } = useAuth();
  const { tags, palette, loading } = useTags(user?.uid);
  const navigate = useNavigate();

  const [newName, setNewName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(
    null,
  );
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [swatchOpenFor, setSwatchOpenFor] = useState<string | null>(null);

  // Click-outside dismissal for the color swatch popover. We track the
  // popover by tag name (only one open at a time) and close it whenever
  // a click lands outside the open row's swatch UI.
  const popoverRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!swatchOpenFor) return;
    function onDocClick(e: MouseEvent) {
      const p = popoverRef.current;
      if (p && !p.contains(e.target as Node)) setSwatchOpenFor(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [swatchOpenFor]);

  // All hooks above early returns.
  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function withBusy<T>(
    tag: string | null,
    op: () => Promise<T>,
  ): Promise<T | null> {
    setError(null);
    setBusyTag(tag);
    try {
      return await op();
    } catch (err) {
      console.error("Tag op:", err);
      setError(err instanceof Error ? err.message : "Operation failed.");
      return null;
    } finally {
      setBusyTag(null);
    }
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  async function handleAdd() {
    if (!user || !newName.trim()) return;
    setAdding(true);
    const result = await withBusy(null, () => addTag(user.uid, newName));
    setAdding(false);
    if (result !== null) {
      setNewName("");
      setIsAddingTag(false);
    }
  }

  function openAddTag() {
    setNewName("");
    setIsAddingTag(true);
    setError(null);
  }

  function cancelAddTag() {
    setIsAddingTag(false);
    setNewName("");
  }

  async function handleRename(oldName: string) {
    if (!user || !renameValue.trim()) return;
    const result = await withBusy(oldName, () =>
      renameTag(user.uid, oldName, renameValue),
    );
    if (result !== null) {
      setRenamingTag(null);
      setRenameValue("");
    }
  }

  async function handleDeleteConfirmed() {
    if (!user || !confirmDeleteName) return;
    const name = confirmDeleteName;
    setConfirmDeleteName(null);
    await withBusy(name, () => deleteTag(user.uid, name));
  }

  async function handleSetColor(tag: string, tone: TagTone) {
    setSwatchOpenFor(null);
    if (!user) return;
    await withBusy(tag, () => setTagColor(user.uid, tag, tone));
  }

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
          Tags
        </h1>
        <Button
          type="button"
          variant="primary"
          icon="plus"
          size="sm"
          onClick={openAddTag}
          disabled={isAddingTag}
        >
          <span className="hidden sm:inline">Add tag</span>
        </Button>
      </div>
      <p className="font-sans text-sm text-ink-700 m-0 mb-6 max-w-[460px]">
        Tags label recipes for cross-cutting themes — weeknight, vegetarian,
        kid-favorite. Click the swatch to pick a color, the name to rename, or
        merge a duplicate into the version you want to keep.
      </p>

      {loading ? (
        <p className="font-sans text-sm text-ink-500">Loading…</p>
      ) : tags.length === 0 && !isAddingTag ? (
        <p className="font-sans text-sm text-ink-500">
          No tags yet. Click &ldquo;Add tag&rdquo; to create one, or add tags to
          a recipe to see them here.
        </p>
      ) : (
        <ul
          className={[
            "list-none m-0 p-0 bg-white rounded-lg border",
            "border-[var(--border-faint)] shadow-xs overflow-visible",
          ].join(" ")}
        >
          {tags.map((t, i) => {
            const isLast = i === tags.length - 1 && !isAddingTag;
            const isRenaming = renamingTag === t.name;
            const isBusy = busyTag === t.name;
            const isSwatchOpen = swatchOpenFor === t.name;
            return (
              <li
                key={t.name}
                className={[
                  "relative flex items-center gap-3 px-4 py-3",
                  isLast ? "" : "border-b border-[var(--border-faint)]",
                ].join(" ")}
              >
                {/* Color swatch button — opens the palette popover */}
                <div className="relative" ref={isSwatchOpen ? popoverRef : null}>
                  <button
                    type="button"
                    onClick={() =>
                      setSwatchOpenFor((cur) =>
                        cur === t.name ? null : t.name,
                      )
                    }
                    aria-label={`Change color for ${t.name}`}
                    title="Change color"
                    disabled={isBusy}
                    className={[
                      "w-6 h-6 rounded-full border border-paper-400",
                      "transition-colors duration-100 cursor-pointer",
                      "hover:ring-2 hover:ring-tomato-300/40",
                      TAG_SWATCH_CLASSES[t.tone],
                      isBusy ? "opacity-50 cursor-default" : "",
                    ].join(" ")}
                  />
                  {isSwatchOpen && (
                    <SwatchPopover
                      currentTone={t.tone}
                      onPick={(tone) => handleSetColor(t.name, tone)}
                    />
                  )}
                </div>

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
                          handleRename(t.name);
                        } else if (e.key === "Escape") {
                          setRenamingTag(null);
                          setRenameValue("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleRename(t.name)}
                      disabled={isBusy || !renameValue.trim()}
                    >
                      {isBusy ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRenamingTag(null);
                        setRenameValue("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Tag name — click to rename. Rendered as a Tag
                        chip inside the button so the user sees the
                        live color preview right next to the swatch. */}
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingTag(t.name);
                        setRenameValue(t.name);
                      }}
                      disabled={isBusy}
                      aria-label={`Rename ${t.name}`}
                      title="Click to rename"
                      className={[
                        "flex-1 text-left px-1.5 py-1 -mx-1.5 -my-1 rounded",
                        "transition-colors duration-100",
                        isBusy
                          ? "cursor-default opacity-60"
                          : "cursor-pointer hover:bg-paper-200",
                        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      ].join(" ")}
                    >
                      <Tag tone={t.tone}>{t.name}</Tag>
                    </button>
                    <span className="font-mono text-xs text-ink-400 [font-feature-settings:'tnum'] tabular-nums">
                      {t.count}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMergeFrom(t.name)}
                      disabled={isBusy || tags.length < 2}
                      aria-label={`Merge ${t.name} into another tag`}
                      title="Merge into another tag"
                      className={[
                        "flex-none p-1.5 rounded transition-colors duration-100",
                        isBusy || tags.length < 2
                          ? "text-ink-300 cursor-default"
                          : "text-ink-400 hover:text-tomato-700 hover:bg-paper-200",
                        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      ].join(" ")}
                    >
                      <Icon name="git-merge" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteName(t.name)}
                      disabled={isBusy}
                      aria-label={`Delete ${t.name}`}
                      title="Delete tag"
                      className={[
                        "flex-none p-1.5 rounded transition-colors duration-100",
                        isBusy
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

          {isAddingTag && (
            <li className="flex items-center gap-2 px-4 py-3 bg-paper-50">
              <Input
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  } else if (e.key === "Escape") {
                    cancelAddTag();
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
                onClick={cancelAddTag}
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
        title="Delete tag?"
        message={
          confirmDeleteName
            ? `"${confirmDeleteName}" will be removed from every recipe that uses it. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setConfirmDeleteName(null)}
        onConfirm={handleDeleteConfirmed}
      />

      <MergeDialog
        open={mergeFrom !== null}
        sourceTag={mergeFrom}
        allTags={tags}
        palette={palette}
        busy={busyTag === mergeFrom}
        onCancel={() => setMergeFrom(null)}
        onConfirm={async (target) => {
          if (!user || !mergeFrom) return;
          const source = mergeFrom;
          await withBusy(source, () => mergeTags(user.uid, source, target));
          setMergeFrom(null);
        }}
      />
    </div>
  );
}

interface SwatchPopoverProps {
  currentTone: TagTone;
  onPick: (tone: TagTone) => void;
}

/**
 * Small flyout next to the swatch — color discs laid out in a 5-per-row
 * grid (currently 5 × 2 with the expanded palette). Sits absolutely-
 * positioned below the swatch button. Closes on outside click via the
 * parent's effect, on pick via the parent's setter.
 */
function SwatchPopover({ currentTone, onPick }: SwatchPopoverProps) {
  return (
    <div
      role="dialog"
      aria-label="Pick a color"
      // `grid-template-columns: repeat(5, 1.5rem)` sizes each column to
      // the disc's natural 24 px. Tailwind's `grid-cols-5` uses
      // `minmax(0, 1fr)` which lets columns collapse below the button
      // width when the popover has no explicit width — that's how the
      // discs ended up stacked in a tiny pile. Sticking to an inline
      // style for the columns avoids generating arbitrary-value
      // utilities and keeps the swatch size locked to the design token.
      style={{ gridTemplateColumns: "repeat(5, 1.5rem)" }}
      className={[
        "absolute z-30 top-full left-0 mt-1",
        "bg-white border border-[var(--border-faint)] rounded-md shadow-md",
        "p-2 grid gap-1.5",
      ].join(" ")}
    >
      {TAG_TONES.map((tone) => {
        const active = tone === currentTone;
        return (
          <button
            key={tone}
            type="button"
            onClick={() => onPick(tone)}
            aria-label={`Use ${tone} color`}
            title={tone}
            className={[
              "w-6 h-6 rounded-full border transition-all duration-100",
              TAG_SWATCH_CLASSES[tone],
              active
                ? "border-ink-700 ring-2 ring-tomato-300/40"
                : "border-paper-400 hover:ring-2 hover:ring-paper-400/60",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

interface MergeDialogProps {
  open: boolean;
  sourceTag: string | null;
  allTags: TagSummary[];
  palette: Record<string, TagTone>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (target: string) => Promise<void>;
}

/**
 * Modal for picking a merge target. Drops down a Select scoped to all
 * tags other than the source. Confirming runs the merge — the parent
 * page handles the busy state + error.
 */
function MergeDialog({
  open,
  sourceTag,
  allTags,
  palette,
  busy,
  onCancel,
  onConfirm,
}: MergeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState("");

  const candidates = useMemo(
    () => allTags.filter((t) => t.name !== sourceTag),
    [allTags, sourceTag],
  );

  // Reset target whenever the dialog re-opens for a different source —
  // otherwise the stale previous selection lingers.
  useEffect(() => {
    if (open) setTarget(candidates[0]?.name ?? "");
  }, [open, candidates]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const previewTone = target
    ? tagToneFor(target, palette)
    : ("default" as TagTone);

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
      {/*
        method="dialog" + a submit-type Merge button makes Enter fire
        the merge from any focused control inside the dialog (including
        while the Select has focus). We preventDefault so React's
        navigation timing — close → list refresh — stays in our hands.
      */}
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!target || busy) return;
          void onConfirm(normalizeTag(target));
        }}
        className="bg-white rounded-xl shadow-lg p-6 max-w-[440px] w-[90vw]"
      >
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-2 leading-snug">
          Merge tag
        </h2>
        <p className="font-sans text-sm leading-relaxed text-ink-700 m-0 mb-4">
          Every recipe tagged{" "}
          {sourceTag ? <Tag tone="default">{sourceTag}</Tag> : null} will be
          re-tagged with the tag you pick. The original tag is removed.
        </p>
        <label className="block font-sans text-sm text-ink-700 mb-1.5">
          Merge into
        </label>
        <Select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={candidates.length === 0}
        >
          {candidates.length === 0 ? (
            <option value="">No other tags available</option>
          ) : (
            candidates.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))
          )}
        </Select>
        {target && (
          <div className="mt-3 flex items-center gap-2 font-sans text-xs text-ink-500">
            <span>Result:</span>
            <Tag tone={previewTone}>{target}</Tag>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {/*
            autoFocus the primary action so native dialog focus lands
            on Merge — Enter then clicks Merge regardless of where
            focus drifts inside the form. Without this the dialog
            would open with focus on Cancel and Enter would close
            instead of merge.
          */}
          <Button
            type="submit"
            variant="primary"
            autoFocus
            disabled={busy || !target}
          >
            {busy ? "Merging…" : "Merge"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
