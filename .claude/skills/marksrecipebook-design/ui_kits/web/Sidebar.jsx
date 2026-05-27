// Sidebar — chapter navigation. Always visible on desktop, drawer on mobile.

function Sidebar({ chapters, activeChapter, onPickChapter, onNew, onImport, onSettings, onSignOut, user, recipeCounts }) {
  return (
    <aside style={{
      width: "260px", flex: "0 0 260px",
      background: "var(--paper-50)",
      borderRight: "1px solid var(--border-faint)",
      display: "flex", flexDirection: "column",
      padding: "20px 0",
      height: "100vh", position: "sticky", top: 0,
    }}>
      <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
        <img src="../../assets/monogram.svg" width="34" height="34" alt="" style={{ flexShrink: 0 }}/>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "15px", lineHeight: 1.25, color: "var(--ink-900)" }}>Marks Family</span>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "14px", lineHeight: 1.25, color: "var(--tomato-500)" }}>Recipe Book</span>
        </div>
      </div>

      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <Button variant="primary" icon="plus" onClick={onNew} style={{ width: "100%", justifyContent: "flex-start" }}>
          New recipe
        </Button>
        <Button variant="secondary" icon="sparkles" onClick={onImport} style={{ width: "100%", justifyContent: "flex-start" }}>
          Import from URL
        </Button>
      </div>

      <Eyebrow style={{ padding: "16px 24px 8px" }}>Chapters</Eyebrow>

      <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {chapters.map((c) => {
          const isActive = activeChapter === c;
          const count = recipeCounts[c] || 0;
          return (
            <button key={c} onClick={() => onPickChapter(c)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", border: 0, background: isActive ? "var(--paper-200)" : "transparent",
              padding: "9px 14px", borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)", fontSize: "14px",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--ink-900)" : "var(--ink-700)",
              textTransform: "capitalize",
              cursor: "pointer", marginBottom: "1px",
              transition: "background var(--dur-fast)",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--paper-200)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              <span>{c}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-faint)" }}>{count}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px 14px 0", borderTop: "1px solid var(--border-faint)" }}>
        <button onClick={onSettings} style={{
          width: "100%", display: "flex", alignItems: "center", gap: "10px",
          background: "transparent", border: 0, cursor: "pointer",
          padding: "8px 10px", borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-muted)",
          textAlign: "left",
        }}>
          <Icon name="book-open" size={16}/>
          Manage chapters
        </button>
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 10px 4px",
        }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "var(--radius-pill)",
            background: "var(--olive-300)", color: "var(--olive-900)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "13px",
          }}>
            {(user.displayName || "?").charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.displayName}</div>
            <div style={{ fontSize: "11px", color: "var(--fg-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
          </div>
          <button onClick={onSignOut} title="Sign out" style={{
            background: "transparent", border: 0, cursor: "pointer",
            color: "var(--fg-subtle)", padding: "4px",
          }}>
            <Icon name="log-out" size={16}/>
          </button>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
