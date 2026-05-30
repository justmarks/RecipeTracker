// ChaptersView — matches production: single card, drag-handle + up/down reorder,
// click-name-to-rename inline, icon-only delete with confirm dialog,
// "Add chapter" header button that opens an inline add-row at the bottom.

function ChaptersView({ chapters, onBack, onChange }) {
  const [list, setList] = useState(chapters);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const commit = (next) => { setList(next); onChange?.(next); };

  const move = (name, dir) => {
    const idx = list.indexOf(name);
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    commit(next);
  };

  const startRename = (name) => { setRenaming(name); setRenameValue(name); };
  const saveRename = (oldName) => {
    if (!renameValue.trim()) return;
    commit(list.map((c) => (c === oldName ? renameValue.trim() : c)));
    setRenaming(null); setRenameValue("");
  };

  const addNew = () => {
    if (!newName.trim()) return;
    commit([...list, newName.trim()]);
    setNewName(""); setIsAdding(false);
  };

  const doDelete = () => {
    if (!confirmDelete) return;
    commit(list.filter((c) => c !== confirmDelete));
    setConfirmDelete(null);
  };

  // Lightweight drag reorder (pointer-based, uniform row height).
  const ulRef = React.useRef(null);
  const startDrag = (startIdx) => (e) => {
    e.preventDefault();
    const firstRow = ulRef.current?.firstElementChild;
    const rowH = firstRow?.getBoundingClientRect().height ?? 56;
    setDragIdx(startIdx); setOverIdx(startIdx);
    let cur = startIdx;
    const onMove = (ev) => {
      const top = ulRef.current.getBoundingClientRect().top;
      const slot = Math.max(0, Math.min(list.length - 1, Math.floor((ev.clientY - top) / rowH)));
      if (slot !== cur) { cur = slot; setOverIdx(slot); }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragIdx(null); setOverIdx(null);
      if (cur !== startIdx) {
        const next = [...list];
        const [item] = next.splice(startIdx, 1);
        next.splice(cur, 0, item);
        commit(next);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const isDragging = dragIdx !== null;
  // Preview order during drag
  let displayOrder = list;
  if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
    displayOrder = [...list];
    const [item] = displayOrder.splice(dragIdx, 1);
    displayOrder.splice(overIdx, 0, item);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: "640px", margin: "0 auto" }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack}
              style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
          margin: 0, letterSpacing: "-0.015em", color: "var(--ink-900)",
        }}>Chapters</h1>
        <Button variant="primary" icon="plus" size="sm" onClick={() => { setNewName(""); setIsAdding(true); }} disabled={isAdding}>
          Add chapter
        </Button>
      </div>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 24px", maxWidth: "440px" }}>
        Chapters group your recipes like sections in a cookbook. Click a name to rename, drag to reorder — recipes in renamed chapters move with them.
      </p>

      <ul ref={ulRef} style={{
        listStyle: "none", margin: 0, padding: 0,
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-faint)", overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
        userSelect: isDragging ? "none" : "auto",
      }}>
        {displayOrder.map((c, visualIdx) => {
          const originalIdx = list.indexOf(c);
          const isRenaming = renaming === c;
          const isLast = visualIdx === displayOrder.length - 1 && !isAdding;
          const beingDragged = originalIdx === dragIdx;
          return (
            <li key={c} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px",
              borderBottom: isLast ? 0 : "1px solid var(--border-faint)",
              transition: "background var(--dur-fast)",
              position: beingDragged ? "relative" : "static",
              zIndex: beingDragged ? 10 : "auto",
              background: beingDragged ? "var(--paper-50)" : "transparent",
              boxShadow: beingDragged ? "var(--shadow-md)" : "none",
            }}>
              {/* Drag handle */}
              <button
                aria-label={`Drag to reorder ${c}`}
                disabled={isRenaming}
                onPointerDown={isRenaming ? undefined : startDrag(originalIdx)}
                style={{
                  flex: "0 0 auto", background: "transparent", border: 0, padding: "2px",
                  color: beingDragged ? "var(--ink-700)" : "var(--ink-300)",
                  cursor: isRenaming ? "default" : beingDragged ? "grabbing" : "grab",
                  opacity: isRenaming ? 0.3 : 1,
                  touchAction: "none", display: "flex",
                }}>
                <Icon name="grip-vertical" size={16}/>
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <button onClick={() => move(c, "up")} disabled={originalIdx === 0 || isDragging}
                        style={reorderBtn(originalIdx === 0 || isDragging)}>
                  <Icon name="chevron-up" size={14}/>
                </button>
                <button onClick={() => move(c, "down")} disabled={originalIdx === list.length - 1 || isDragging}
                        style={reorderBtn(originalIdx === list.length - 1 || isDragging)}>
                  <Icon name="chevron-down" size={14}/>
                </button>
              </div>

              {isRenaming ? (
                <div style={{ display: "flex", gap: "8px", flex: 1, alignItems: "center" }}>
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus
                         onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveRename(c); } else if (e.key === "Escape") { setRenaming(null); } }}/>
                  <Button variant="primary" size="sm" onClick={() => saveRename(c)} disabled={!renameValue.trim()}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => startRename(c)}
                    disabled={isDragging}
                    title="Click to rename"
                    aria-label={`Rename ${c}`}
                    style={{
                      flex: 1, textAlign: "left",
                      padding: "4px 8px", margin: "-4px -8px",
                      borderRadius: "var(--radius-sm)", border: 0, background: "transparent",
                      fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "15px",
                      color: "var(--ink-900)", textTransform: "capitalize",
                      cursor: isDragging ? "default" : "pointer",
                      transition: "background var(--dur-fast)",
                    }}
                    onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = "var(--paper-200)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    {c}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c)}
                    disabled={isDragging}
                    title="Delete chapter"
                    aria-label={`Delete ${c}`}
                    style={{
                      flex: "0 0 auto", padding: "6px", borderRadius: "var(--radius-sm)",
                      border: 0, background: "transparent",
                      color: "var(--ink-300)", cursor: isDragging ? "default" : "pointer",
                      display: "flex", transition: "color var(--dur-fast), background var(--dur-fast)",
                    }}
                    onMouseEnter={(e) => { if (!isDragging) { e.currentTarget.style.color = "var(--tomato-700)"; e.currentTarget.style.background = "var(--tomato-50)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-300)"; e.currentTarget.style.background = "transparent"; }}>
                    <Icon name="trash" size={16}/>
                  </button>
                </>
              )}
            </li>
          );
        })}

        {isAdding && (
          <li style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 16px", background: "var(--paper-50)" }}>
            <Input value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} placeholder="Chapter name"
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } else if (e.key === "Escape") { setIsAdding(false); } }}/>
            <Button variant="primary" size="sm" onClick={addNew} disabled={!newName.trim()}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
          </li>
        )}
      </ul>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(42, 31, 24, 0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }} onClick={() => setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--bg-card)", borderRadius: "var(--radius-xl)",
            padding: "28px", maxWidth: "420px", width: "100%",
            boxShadow: "var(--shadow-lg)",
          }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "24px", margin: "0 0 10px", color: "var(--ink-900)" }}>
              Delete chapter?
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.55, color: "var(--fg-muted)", margin: "0 0 24px" }}>
              <strong style={{ textTransform: "capitalize", color: "var(--ink-700)" }}>&ldquo;{confirmDelete}&rdquo;</strong> will be removed from your cookbook. Any recipes still in it will move to the &ldquo;Uncategorized&rdquo; chapter.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Keep</Button>
              <Button variant="primary" style={{ background: "var(--tomato-600)" }} onClick={doDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function reorderBtn(disabled) {
  return {
    padding: "2px", background: "transparent", border: 0,
    color: "var(--ink-500)", cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.3 : 1, display: "flex",
    transition: "color var(--dur-fast)",
  };
}

window.ChaptersView = ChaptersView;
