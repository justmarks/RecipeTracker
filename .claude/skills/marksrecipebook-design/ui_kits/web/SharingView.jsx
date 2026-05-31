// SharingView — blanket auto-share settings. Two directions:
// outgoing (people who see everything you own) and incoming (cookbooks shared with you).

function SharingView({ onBack }) {
  const [email, setEmail] = useState("");
  const [outgoing, setOutgoing] = useState([
    { uid: "u_mom", email: "mom@marksfamily.test" },
    { uid: "u_eli", email: "eli@marksfamily.test" },
  ]);
  const incoming = [
    { uid: "u_carol", email: "carol@marksfamily.test" },
    { uid: "u_dad", email: "dad@marksfamily.test" },
  ];

  const add = () => {
    const v = email.trim();
    if (!v) return;
    if (!outgoing.some((p) => p.email === v)) {
      setOutgoing([...outgoing, { uid: "u_" + Date.now(), email: v }]);
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
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 28px", maxWidth: "480px", lineHeight: 1.55 }}>
        Share your whole cookbook with family. For a single recipe, use the Share button on the recipe instead.
      </p>

      {/* Share your cookbook */}
      <section style={{
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-faint)", boxShadow: "var(--shadow-sm)",
        padding: "20px 22px", marginBottom: "28px",
      }}>
        <Eyebrow style={{ marginBottom: "10px" }}>Share your cookbook</Eyebrow>
        <div style={{ display: "flex", gap: "8px" }}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="family@example.com"
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}/>
          <Button variant="primary" icon="share-2" onClick={add} disabled={!email.trim()}>Share</Button>
        </div>
      </section>

      {/* Outgoing grants */}
      <section style={{ marginBottom: "28px" }}>
        <Eyebrow style={{ marginBottom: "10px" }}>People who can see all your recipes</Eyebrow>
        {outgoing.length === 0 ? (
          <EmptyNote>No one yet. Add a family member above and they'll see every recipe you own.</EmptyNote>
        ) : (
          <GrantList>
            {outgoing.map((p, i) => (
              <GrantRow key={p.uid} icon="mail" email={p.email} last={i === outgoing.length - 1}
                action={<Button variant="danger" size="sm" onClick={() => setOutgoing(outgoing.filter((x) => x.uid !== p.uid))}>Remove</Button>}/>
            ))}
          </GrantList>
        )}
      </section>

      {/* Incoming grants */}
      <section>
        <Eyebrow style={{ marginBottom: "10px" }}>People who shared their cookbook with you</Eyebrow>
        {incoming.length === 0 ? (
          <EmptyNote>No one has shared their cookbook with you yet.</EmptyNote>
        ) : (
          <GrantList>
            {incoming.map((p, i) => (
              <GrantRow key={p.uid} icon="users" email={p.email} last={i === incoming.length - 1}/>
            ))}
          </GrantList>
        )}
      </section>
    </div>
  );
}

function GrantList({ children }) {
  return (
    <ul style={{
      listStyle: "none", margin: 0, padding: 0,
      background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border-faint)", overflow: "hidden",
      boxShadow: "var(--shadow-xs)",
    }}>{children}</ul>
  );
}

function GrantRow({ icon, email, action, last }) {
  return (
    <li style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 16px",
      borderBottom: last ? 0 : "1px solid var(--border-faint)",
    }}>
      <span style={{ color: "var(--fg-subtle)", display: "flex", flexShrink: 0 }}><Icon name={icon} size={16}/></span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--ink-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
      {action}
    </li>
  );
}

function EmptyNote({ children }) {
  return (
    <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-subtle)", padding: "16px 4px", margin: 0, lineHeight: 1.55 }}>
      {children}
    </p>
  );
}

window.SharingView = SharingView;
