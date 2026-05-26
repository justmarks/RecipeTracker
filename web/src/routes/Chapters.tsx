import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../lib/useAuth";
import {
  addChapter,
  deleteChapter,
  moveChapter,
  renameChapter,
  useChapters,
} from "../lib/categories";

export function Chapters() {
  const { user, loading: authLoading } = useAuth();
  const { chapters, loading } = useChapters(user?.uid);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingChapter, setRenamingChapter] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyChapter, setBusyChapter] = useState<string | null>(null);

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

  async function handleDelete(name: string) {
    if (!user) return;
    if (!confirm(`Delete chapter "${name}"?`)) return;
    await withBusy(name, () => deleteChapter(user.uid, name));
  }

  async function handleMove(name: string, direction: "up" | "down") {
    if (!user) return;
    await withBusy(name, () => moveChapter(user.uid, name, direction));
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Chapters</h1>
      <p className="mt-1 text-sm text-slate-500">
        Chapters group your recipes like sections in a cookbook. Rename or
        reorder freely — recipes in renamed chapters move with them.
      </p>

      {loading ? (
        <p className="mt-6 text-slate-500">Loading…</p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded border border-slate-200">
          {chapters.map((chapter, idx) => {
            const isRenaming = renamingChapter === chapter;
            const isBusy = busyChapter === chapter;
            return (
              <li key={chapter} className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMove(chapter, "up")}
                    disabled={idx === 0 || isBusy}
                    className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    aria-label={`Move ${chapter} up`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(chapter, "down")}
                    disabled={idx === chapters.length - 1 || isBusy}
                    className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    aria-label={`Move ${chapter} down`}
                  >
                    ▼
                  </button>
                </div>

                {isRenaming ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(chapter)}
                      disabled={isBusy || !renameValue.trim()}
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isBusy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingChapter(null);
                        setRenameValue("");
                      }}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 capitalize">{chapter}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingChapter(chapter);
                        setRenameValue(chapter);
                      }}
                      disabled={isBusy}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(chapter)}
                      disabled={isBusy}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Add a chapter</h2>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. dessert"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </section>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
