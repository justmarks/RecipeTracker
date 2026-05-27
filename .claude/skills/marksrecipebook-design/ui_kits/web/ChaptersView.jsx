// ChaptersView — reorder / rename / delete chapters.

function ChaptersView({ chapters, onBack, onChange }) {
  const [list, setList] = useState(chapters);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [newName, setNewName] = useState("");

  const move = (name, dir) => {
    const idx = list.indexOf(name);
    if (idx < 0) return;
    const next = [...list];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= list.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setList(next); onChange?.(next);
  };

  const remove = (name) => {
    if (!confirm(`Delete chapter "${name}"?`)) return;
    const next = list.filter((c) => c !== name);
    setList(next); onChange?.(next);
  };

  const startRename = (name) => { setRenaming(name); setRenameValue(name); };

  const saveRename = (oldName) => {
    if (!renameValue.trim()) return;
    const next = list.map((c) => (c === oldName ? renameValue.trim().toLowerCase() : c));
    setList(next); onChange?.(next);
    setRenaming(null); setRenameValue("");
  };

  const addNew = () => {
    if (!newName.trim()) return;
    const next = [...list, newName.trim().toLowerCase()];
    setList(next); onChange?.(next);
    setNewName("");
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "640px", margin: "0 auto" }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack}
              style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
        margin: "0 0 8px", letterSpacing: "-0.015em", color: "var(--ink-900)",
      }}>Chapters</h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 24px", maxWidth: "440px" }}>
        Chapters group your recipes like sections in a cookbook. Rename or reorder freely — recipes in renamed chapters move with them.
      </p>

      <section style={{ marginBottom: "24px" }}>
        <Field label="Add a chapter">
          <div style={{ display: "flex", gap: "8px" }}>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. brunch"/>
            <Button variant="primary" onClick={addNew} disabled={!newName.trim()}>Add</Button>
          </div>
        </Field>
      </section>

      <ul style={{
        listStyle: "none", margin: 0, padding: 0,
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-faint)", overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
      }}>
        {list.map((c, i) => {
          const isRenaming = renaming === c;
          return (
            <li key={c} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 18px",
              borderBottom: i === list.length - 1 ? 0 : "1px solid var(--border-faint)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <button onClick={() => move(c, "up")} disabled={i === 0}
                        style={{ background: "transparent", border: 0, cursor: i === 0 ? "default" : "pointer", color: "var(--fg-subtle)", opacity: i === 0 ? 0.3 : 1, padding: 0 }}>
                  <Icon name="chevron-up" size={14}/>
                </button>
                <button onClick={() => move(c, "down")} disabled={i === list.length - 1}
                        style={{ background: "transparent", border: 0, cursor: i === list.length - 1 ? "default" : "pointer", color: "var(--fg-subtle)", opacity: i === list.length - 1 ? 0.3 : 1, padding: 0 }}>
                  <Icon name="chevron-down" size={14}/>
                </button>
              </div>

              {isRenaming ? (
                <div style={{ display: "flex", gap: "8px", flex: 1, alignItems: "center" }}>
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus/>
                  <Button variant="primary" size="sm" onClick={() => saveRename(c)}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontWeight: 500, color: "var(--ink-900)", textTransform: "capitalize" }}>{c}</span>
                  <Button variant="ghost" size="sm" onClick={() => startRename(c)}>Rename</Button>
                  <Button variant="danger" size="sm" onClick={() => remove(c)}>Delete</Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

window.ChaptersView = ChaptersView;
