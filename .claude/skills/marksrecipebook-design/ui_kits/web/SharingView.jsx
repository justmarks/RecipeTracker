// SharingView — blanket auto-share settings. Everyone listed sees every recipe
// you own (past and future), distinct from per-recipe sharing in ShareDialog.

function SharingView({ onBack }) {
  const [email, setEmail] = useState("");
  const [people, setPeople] = useState([
    { uid: "u_mom", name: "Susan Marks", email: "mom@marksfamily.test" },
    { uid: "u_eli", name: "Eli Marks", email: "eli@marksfamily.test" },
  ]);

  const add = () => {
    const v = email.trim();
    if (!v) return;
    if (!people.some((p) => p.email === v)) {
      setPeople([...people, { uid: "u_" + Date.now(), name: v.split("@")[0], email: v }]);
    }
    setEmail("");
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "640px", margin: "0 auto" }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack}
              style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
        margin: "0 0 8px", letterSpacing: "-0.015em", color: "var(--ink-900)",
      }}>Sharing</h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 24px", maxWidth: "460px", lineHeight: 1.55 }}>
        People here see <em style={{ fontFamily: "var(--font-display)" }}>every</em> recipe you own — past and future. For one-off sharing, use the Share button on a recipe instead.
      </p>

      <Field label="Add a family member">
        <div style={{ display: "flex", gap: "8px" }}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="family@example.com"
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}/>
          <Button variant="primary" icon="plus" onClick={add} disabled={!email.trim()}>Add</Button>
        </div>
      </Field>

      <div style={{ marginTop: "28px" }}>
        <Eyebrow style={{ marginBottom: "10px" }}>Auto-shared with {people.length}</Eyebrow>
        {people.length === 0 ? (
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-subtle)", padding: "24px 0", textAlign: "center" }}>
            No one yet. Your recipes are private until you add someone.
          </p>
        ) : (
          <ul style={{
            listStyle: "none", margin: 0, padding: 0,
            background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-faint)", overflow: "hidden",
            boxShadow: "var(--shadow-xs)",
          }}>
            {people.map((p, i) => (
              <li key={p.uid} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "14px 16px",
                borderBottom: i === people.length - 1 ? 0 : "1px solid var(--border-faint)",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "var(--radius-pill)",
                  background: "var(--olive-100)", color: "var(--olive-700)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px",
                  flexShrink: 0, textTransform: "capitalize",
                }}>{(p.name || "?").charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "14px", color: "var(--ink-900)", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--fg-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
                </div>
                <Button variant="danger" size="sm" onClick={() => setPeople(people.filter((x) => x.uid !== p.uid))}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

window.SharingView = SharingView;
