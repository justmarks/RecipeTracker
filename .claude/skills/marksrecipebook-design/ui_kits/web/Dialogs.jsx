// ShareDialog + ConfirmDialog — modal overlays matching production.

function Backdrop({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(42, 31, 24, 0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-card)", borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: "480px",
      }}>
        {children}
      </div>
    </div>
  );
}

function ShareDialog({ recipe, onClose }) {
  const [email, setEmail] = useState("");
  const [shared, setShared] = useState([
    { uid: "u_mom", email: "mom@marksfamily.test" },
  ]);

  const add = () => {
    const v = email.trim();
    if (!v) return;
    if (!shared.some((s) => s.email === v)) setShared([...shared, { uid: "u_" + Date.now(), email: v }]);
    setEmail("");
  };

  return (
    <Backdrop onClose={onClose}>
      <div style={{ padding: "28px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "24px", margin: "0 0 4px", color: "var(--ink-900)" }}>
          Share recipe
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 20px" }}>
          <em style={{ fontFamily: "var(--font-display)" }}>{recipe.title}</em> — anyone you add can see this recipe but not edit or delete it.
        </p>

        <div style={{ display: "flex", gap: "8px" }}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="family@example.com" autoFocus
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}/>
          <Button variant="primary" icon="share-2" onClick={add} disabled={!email.trim()}>Share</Button>
        </div>

        {shared.length > 0 ? (
          <div style={{ marginTop: "24px" }}>
            <Eyebrow style={{ marginBottom: "8px" }}>Shared with</Eyebrow>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
              {shared.map((s) => (
                <li key={s.uid} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 10px", borderRadius: "var(--radius-md)", background: "var(--paper-100)",
                }}>
                  <span style={{ color: "var(--fg-subtle)", display: "flex", flexShrink: 0 }}><Icon name="mail" size={14}/></span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--ink-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</span>
                  <button onClick={() => setShared(shared.filter((x) => x.uid !== s.uid))} style={{
                    fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--tomato-700)",
                    background: "transparent", border: 0, cursor: "pointer", padding: "2px 6px",
                  }}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-subtle)", marginTop: "20px" }}>
            No one else has access yet. To share all your recipes with a family member, use <span style={{ color: "var(--ink-700)" }}>Settings → Sharing</span>.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Backdrop>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Delete", cancelLabel = "Keep", onConfirm, onCancel }) {
  return (
    <Backdrop onClose={onCancel}>
      <div style={{ padding: "28px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "24px", margin: "0 0 10px", color: "var(--ink-900)" }}>
          {title}
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.55, color: "var(--fg-muted)", margin: "0 0 24px" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" style={{ background: "var(--tomato-600)" }} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Backdrop>
  );
}

Object.assign(window, { ShareDialog, ConfirmDialog });
