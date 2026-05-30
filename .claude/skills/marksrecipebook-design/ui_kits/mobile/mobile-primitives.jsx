// Mobile primitives — touch-sized buttons, tab bar, header.

const { useState: mUseState } = React;

// ---------- ICON (mirror of web kit) ----------
const M_ICONS = {
  "plus": <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  "search": <><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></>,
  "book": <><path d="M2 4 L10 6 L10 20 L2 18 Z"/><path d="M22 4 L14 6 L14 20 L22 18 Z"/><path d="M10 6 L14 6"/></>,
  "user": <><circle cx="12" cy="8" r="4"/><path d="M4 21 v-1 a6 6 0 0 1 6-6 h4 a6 6 0 0 1 6 6 v1"/></>,
  "sparkles": <><path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z"/><path d="M19 3 L19.5 5 L21.5 5.5 L19.5 6 L19 8 L18.5 6 L16.5 5.5 L18.5 5 Z"/></>,
  "chevron-right": <><polyline points="9 6 15 12 9 18"/></>,
  "chevron-left": <><polyline points="15 6 9 12 15 18"/></>,
  "chevron-up": <><polyline points="6 15 12 9 18 15"/></>,
  "chevron-down": <><polyline points="6 9 12 15 18 9"/></>,
  "x": <><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>,
  "share": <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="8.5" y1="11" x2="15.5" y2="7.5"/><line x1="8.5" y1="13" x2="15.5" y2="16.5"/></>,
  "settings": <><circle cx="12" cy="12" r="3"/><path d="M19.4 15 a1.7 1.7 0 0 0 0.3 1.8 l0.1 0.1 a2 2 0 0 1-2.8 2.8 l-0.1-0.1 a1.7 1.7 0 0 0-1.8-0.3 a1.7 1.7 0 0 0-1 1.5 V21 a2 2 0 0 1-4 0 v-0.1 a1.7 1.7 0 0 0-1.1-1.5 a1.7 1.7 0 0 0-1.8 0.3 l-0.1 0.1 a2 2 0 0 1-2.8-2.8 l0.1-0.1 a1.7 1.7 0 0 0 0.3-1.8 a1.7 1.7 0 0 0-1.5-1 H3 a2 2 0 0 1 0-4 h0.1 a1.7 1.7 0 0 0 1.5-1.1 a1.7 1.7 0 0 0-0.3-1.8 l-0.1-0.1 a2 2 0 0 1 2.8-2.8 l0.1 0.1 a1.7 1.7 0 0 0 1.8 0.3 a1.7 1.7 0 0 0 1-1.5 V3 a2 2 0 0 1 4 0 v0.1 a1.7 1.7 0 0 0 1 1.5 a1.7 1.7 0 0 0 1.8-0.3 l0.1-0.1 a2 2 0 0 1 2.8 2.8 l-0.1 0.1 a1.7 1.7 0 0 0-0.3 1.8 a1.7 1.7 0 0 0 1.5 1 H21 a2 2 0 0 1 0 4 h-0.1 a1.7 1.7 0 0 0-1.5 1 Z"/></>,
  "link": <><path d="M10 14 a4 4 0 0 1 0-6 l3-3 a4 4 0 0 1 6 6 l-1 1"/><path d="M14 10 a4 4 0 0 1 0 6 l-3 3 a4 4 0 0 1-6-6 l1-1"/></>,
  "clock": <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></>,
  "pencil": <><path d="M16 3 L21 8 L8 21 L3 21 L3 16 Z"/><line x1="14" y1="5" x2="19" y2="10"/></>,
};

function MIcon({ name, size = 22, color = "currentColor", style = {} }) {
  const path = M_ICONS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
         style={style} aria-hidden="true">
      {path}
    </svg>
  );
}

// ---------- TOP HEADER (sticky page header w/ title + actions) ----------
function MHeader({ title, eyebrow, leading, trailing, large = true }) {
  return (
    <div style={{
      paddingTop: large ? 64 : 56,
      paddingLeft: 20, paddingRight: 20, paddingBottom: 16,
      background: "var(--paper-100)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        minHeight: 34, marginBottom: large ? 12 : 0,
      }}>
        <div style={{ minWidth: 34 }}>{leading}</div>
        <div style={{ minWidth: 34 }}>{trailing}</div>
      </div>
      {eyebrow && (
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
          color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: "0.12em",
          marginBottom: 4,
        }}>{eyebrow}</div>
      )}
      {large && (
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 34,
          letterSpacing: "-0.02em", lineHeight: 1.05,
          color: "var(--ink-900)", margin: 0,
          textTransform: "capitalize",
        }}>{title}</h1>
      )}
    </div>
  );
}

// ---------- TAB BAR ----------
function MTabBar({ active = "recipes", onChange }) {
  const items = [
    { id: "recipes", label: "Recipes", icon: "book" },
    { id: "import",  label: "Import",  icon: "sparkles" },
    { id: "you",     label: "You",     icon: "user" },
  ];
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      paddingTop: 8, paddingBottom: 30,
      background: "rgba(251, 246, 238, 0.92)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid var(--border-faint)",
      display: "flex", justifyContent: "space-around",
    }}>
      {items.map((it) => {
        const isActive = it.id === active;
        return (
          <button key={it.id} onClick={() => onChange?.(it.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "transparent", border: 0, padding: "6px 14px", cursor: "pointer",
            color: isActive ? "var(--tomato-500)" : "var(--ink-500)",
            transition: "color 100ms",
          }}>
            <MIcon name={it.icon} size={24}/>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: isActive ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- BUTTON (mobile, full-width preference) ----------
function MButton({ variant = "primary", icon, children, style, ...rest }) {
  const base = {
    fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 15, lineHeight: 1,
    borderRadius: 12, border: 0, cursor: "pointer", padding: "14px 18px",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 48, width: "100%",
  };
  if (variant === "primary") { base.background = "var(--tomato-500)"; base.color = "#fff"; }
  if (variant === "secondary") { base.background = "var(--bg-card)"; base.color = "var(--ink-900)"; base.border = "1px solid var(--border-strong)"; }
  if (variant === "ghost") { base.background = "transparent"; base.color = "var(--tomato-600)"; base.padding = "12px 14px"; }
  return (
    <button style={{ ...base, ...style }} {...rest}>
      {icon && <MIcon name={icon} size={18}/>}
      {children}
    </button>
  );
}

// ---------- TAG ----------
function MTag({ tone = "default", children }) {
  const tones = {
    veg: { bg: "var(--olive-100)", fg: "var(--olive-700)" },
    gf:  { bg: "var(--saffron-100)", fg: "var(--saffron-700)" },
    dessert: { bg: "var(--plum-100)", fg: "var(--plum-700)" },
    default: { bg: "var(--paper-200)", fg: "var(--ink-700)" },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
      padding: "3px 8px", borderRadius: 4,
      background: t.bg, color: t.fg, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function mTagToneFor(tag) {
  if (tag === "vegetarian" || tag === "vegan") return "veg";
  if (tag === "gluten-free" || tag === "dairy-free") return "gf";
  if (tag === "birthday" || tag === "dessert") return "dessert";
  return "default";
}

Object.assign(window, { MIcon, MHeader, MTabBar, MButton, MTag, mTagToneFor });
