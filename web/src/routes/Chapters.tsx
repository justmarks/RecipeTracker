import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../lib/useAuth";
import {
  addChapter,
  deleteChapter,
  moveChapter,
  renameChapter,
  useChapters,
} from "../lib/categories";
import { Button, ConfirmDialog, Field, Icon, Input } from "../components/ui";

/**
 * Chapters management — list as a single card with paper-faint
 * dividers between rows. Each row carries reorder arrows
 * (chevron-up / chevron-down icons), the capitalized chapter name,
 * and ghost Rename + danger Delete actions. Add-a-chapter form sits
 * below the card.
 */
export function Chapters() {
  const { user, loading: authLoading } = useAuth();
  const { chapters, loading } = useChapters(user?.uid);
  const navigate = useNavigate();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingChapter, setRenamingChapter] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyChapter, setBusyChapter] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);

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

  async function handleAdd() {
    if (!user || !newName.trim()) return;
    setAdding(true);
    const result = await withBusy(null, () => addChapter(user.uid, newName));
    setAdding(false);
    if (result !== null) setNewName("");
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

  return (
    <div className="mx-auto max-w-[640px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={() => navigate("/")}
        className="px-0 mb-4"
      >
        Back
      </Button>

      <h1 className="font-display text-[32px] sm:text-[38px] font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-2">
        Chapters
      </h1>
      <p className="font-sans text-sm text-ink-700 m-0 mb-6 max-w-[440px]">
        Chapters group your recipes like sections in a cookbook. Rename or
        reorder freely — recipes in renamed chapters move with them.
      </p>

      <section className="mb-6">
        <Field label="Add a chapter">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. brunch"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              type="button"
              variant="primary"
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
            >
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
        </Field>
      </section>

      {loading ? (
        <p className="font-sans text-sm text-ink-500">Loading…</p>
      ) : chapters.length === 0 ? (
        <p className="font-sans text-sm text-ink-500">
          No chapters yet. Add one below to get started.
        </p>
      ) : (
        <ul className="list-none m-0 p-0 bg-white rounded-lg border border-[var(--border-faint)] shadow-xs overflow-hidden">
          {chapters.map((chapter, idx) => {
            const isRenaming = renamingChapter === chapter;
            const isBusy = busyChapter === chapter;
            const isLast = idx === chapters.length - 1;
            return (
              <li
                key={chapter}
                className={[
                  "flex items-center gap-3 px-4 py-3.5",
                  isLast ? "" : "border-b border-[var(--border-faint)]",
                ].join(" ")}
              >
                <ReorderControls
                  upDisabled={idx === 0 || isBusy}
                  downDisabled={idx === chapters.length - 1 || isBusy}
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
                    <span className="flex-1 font-sans font-medium text-ink-900 capitalize">
                      {chapter}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRenamingChapter(chapter);
                        setRenameValue(chapter);
                      }}
                      disabled={isBusy}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmDeleteName(chapter)}
                      disabled={isBusy}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </li>
            );
          })}
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
            ? `"${confirmDeleteName}" will be removed from your cookbook. Recipes already in this chapter will keep their data but lose their chapter assignment.`
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
