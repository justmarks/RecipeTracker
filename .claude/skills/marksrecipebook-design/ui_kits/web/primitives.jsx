// Primitives: Button, Input, Field, Tag, Eyebrow, Icon, Toast.
// Loaded as a Babel script. Exposes components on window.

const { useState, useEffect } = React;

// ---------- ICON ----------
// Inline Lucide-style icons. Stroke-based, 1.5px, currentColor.
const ICON_PATHS = {
  "plus": <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  "search": <><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></>,
  "book-open": <><path d="M2 4 L10 6 L10 20 L2 18 Z"/><path d="M22 4 L14 6 L14 20 L22 18 Z"/><path d="M10 6 L14 6"/></>,
  "chevron-right": <><polyline points="9 6 15 12 9 18"/></>,
  "chevron-left": <><polyline points="15 6 9 12 15 18"/></>,
  "chevron-down": <><polyline points="6 9 12 15 18 9"/></>,
  "chevron-up": <><polyline points="6 15 12 9 18 15"/></>,
  "arrow-left": <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
  "pencil": <><path d="M16 3 L21 8 L8 21 L3 21 L3 16 Z"/><line x1="14" y1="5" x2="19" y2="10"/></>,
  "share": <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="8.5" y1="11" x2="15.5" y2="7.5"/><line x1="8.5" y1="13" x2="15.5" y2="16.5"/></>,
  "link": <><path d="M10 14 a4 4 0 0 1 0-6 l3-3 a4 4 0 0 1 6 6 l-1 1"/><path d="M14 10 a4 4 0 0 1 0 6 l-3 3 a4 4 0 0 1-6-6 l1-1"/></>,
  "upload": <><line x1="12" y1="3" x2="12" y2="15"/><polyline points="7 8 12 3 17 8"/><path d="M3 17 v3 a1 1 0 0 0 1 1 h16 a1 1 0 0 0 1-1 v-3"/></>,
  "x": <><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>,
  "check": <><polyline points="4 12 10 18 20 6"/></>,
  "clock": <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></>,
  "trash": <><polyline points="3 6 21 6"/><path d="M5 6 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 v-14"/><path d="M9 6 V4 a1 1 0 0 1 1-1 h4 a1 1 0 0 1 1 1 v2"/></>,
  "log-out": <><path d="M14 4 h4 a2 2 0 0 1 2 2 v12 a2 2 0 0 1-2 2 h-4"/><polyline points="9 16 4 12 9 8"/><line x1="4" y1="12" x2="16" y2="12"/></>,
  "users": <><circle cx="9" cy="8" r="3.5"/><path d="M2 21 v-1 a5 5 0 0 1 5-5 h4 a5 5 0 0 1 5 5 v1"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14 h2 a4 4 0 0 1 4 4 v1"/></>,
  "sparkles": <><path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z"/><path d="M19 3 L19.5 5 L21.5 5.5 L19.5 6 L19 8 L18.5 6 L16.5 5.5 L18.5 5 Z"/></>,
  "grip-vertical": <><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>,
  "heart": <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  "download": <><path d="M3 17 v3 a1 1 0 0 0 1 1 h16 a1 1 0 0 0 1-1 v-3"/><polyline points="7 12 12 17 17 12"/><line x1="12" y1="3" x2="12" y2="17"/></>,
  "mail": <><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></>,
  "image": <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17 L9 12 L13 15 L17 11 L21 15"/></>,
};

function Icon({ name, size = 20, className = "", style = {}, filled = false }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
         className={className} style={style} aria-hidden="true">
      {path}
    </svg>
  );
}

// ---------- BUTTON ----------
const btnBase = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: "14px",
  lineHeight: 1,
  borderRadius: "var(--radius-md)",
  border: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 16px",
  transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
  whiteSpace: "nowrap",
};

function Button({ variant = "primary", size = "md", icon, iconRight, iconFilled = false, children, ...rest }) {
  const styles = { ...btnBase };
  if (size === "sm") { styles.fontSize = "12px"; styles.padding = "7px 12px"; }
  if (size === "lg") { styles.fontSize = "15px"; styles.padding = "12px 22px"; }

  if (variant === "primary") {
    styles.background = "var(--accent)";
    styles.color = "var(--fg-on-primary)";
  } else if (variant === "secondary") {
    styles.background = "transparent";
    styles.color = "var(--fg-default)";
    styles.border = "1px solid var(--border-strong)";
  } else if (variant === "ghost") {
    styles.background = "transparent";
    styles.color = "var(--fg-link)";
    styles.padding = size === "sm" ? "6px 8px" : "8px 10px";
  } else if (variant === "danger") {
    styles.background = "transparent";
    styles.color = "var(--tomato-700)";
  }

  return (
    <button
      style={styles}
      onMouseEnter={(e) => {
        if (variant === "primary") e.currentTarget.style.background = "var(--accent-hover)";
        if (variant === "secondary") e.currentTarget.style.background = "var(--bg-hover)";
        if (variant === "ghost") e.currentTarget.style.color = "var(--fg-link-hover)";
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") e.currentTarget.style.background = "var(--accent)";
        if (variant === "secondary") e.currentTarget.style.background = "transparent";
        if (variant === "ghost") e.currentTarget.style.color = "var(--fg-link)";
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} filled={iconFilled} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

// ---------- INPUT + FIELD ----------
const inputBase = {
  fontFamily: "var(--font-sans)",
  fontSize: "14px",
  color: "var(--fg-default)",
  background: "var(--bg-card)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-md)",
  padding: "10px 12px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
};

function Input({ value, onChange, placeholder, type = "text", style, ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ ...inputBase, ...style }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--border-focus)";
        e.target.style.boxShadow = "var(--shadow-focus)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "var(--border-strong)";
        e.target.style.boxShadow = "none";
      }}
      {...rest}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4, mono, style, ...rest }) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{
        ...inputBase,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: mono ? "13px" : "14px",
        resize: "vertical",
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--border-focus)";
        e.target.style.boxShadow = "var(--shadow-focus)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "var(--border-strong)";
        e.target.style.boxShadow = "none";
      }}
      {...rest}
    />
  );
}

function Field({ label, hint, error, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{
        fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "13px",
        color: "var(--fg-default)", display: "block", marginBottom: "6px",
      }}>{label}</span>
      {children}
      {hint && !error && <span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "var(--fg-subtle)" }}>{hint}</span>}
      {error && <span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "var(--tomato-700)" }}>{error}</span>}
    </label>
  );
}

// ---------- TAG ----------
const TAG_TONES = {
  veg:     { bg: "var(--olive-100)",  fg: "var(--olive-700)" },
  gf:      { bg: "var(--saffron-100)", fg: "var(--saffron-700)" },
  default: { bg: "var(--paper-200)",  fg: "var(--ink-700)" },
  brand:   { bg: "var(--tomato-50)",  fg: "var(--tomato-700)" },
  dessert: { bg: "var(--plum-100)",   fg: "var(--plum-700)" },
};

function Tag({ tone = "default", children }) {
  const t = TAG_TONES[tone] || TAG_TONES.default;
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 500,
      padding: "3px 8px", borderRadius: "var(--radius-sm)",
      background: t.bg, color: t.fg, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function tagToneFor(tag) {
  if (tag === "vegetarian" || tag === "vegan") return "veg";
  if (tag === "gluten-free" || tag === "dairy-free") return "gf";
  if (tag === "birthday" || tag === "dessert") return "dessert";
  return "default";
}

// ---------- EYEBROW ----------
function Eyebrow({ children, style }) {
  return (
    <div style={{
      fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "11px",
      textTransform: "uppercase", letterSpacing: "0.12em",
      color: "var(--fg-subtle)",
      ...style,
    }}>{children}</div>
  );
}

// ---------- META ROW (mono numerics) ----------
function MetaRow({ items }) {
  // items: [{ label, value }]
  return (
    <dl style={{
      display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: "16px", margin: 0,
    }}>
      {items.map((it, i) => (
        <div key={i}>
          <dt style={{
            fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--fg-subtle)", margin: 0,
          }}>{it.label}</dt>
          <dd style={{
            fontFamily: "var(--font-mono)", fontSize: "14px",
            color: "var(--fg-default)", margin: "2px 0 0 0", fontFeatureSettings: '"tnum"',
          }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- TOAST ----------
function Toast({ children, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: "32px", left: "50%",
      transform: `translate(-50%, ${visible ? "0" : "20px"})`,
      opacity: visible ? 1 : 0,
      transition: "all var(--dur-base) var(--ease-out)",
      background: "var(--ink-900)", color: "var(--paper-100)",
      padding: "12px 18px", borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-lg)", fontFamily: "var(--font-sans)", fontSize: "14px",
      display: "inline-flex", alignItems: "center", gap: "10px", pointerEvents: "none",
      zIndex: 1000,
    }}>
      <span style={{ color: "var(--olive-300)" }}><Icon name="check" size={16}/></span>
      {children}
    </div>
  );
}

// ---------- SPRIG DIVIDER (decorative) ----------
function SprigDivider() {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "24px 0" }}>
      <img src="../../assets/sprig-divider.svg" width="240" height="32" alt="" style={{ opacity: 0.9 }}/>
    </div>
  );
}

// ---------- PHOTO FRAME ----------
// One treatment for all recipe photos. Handles missing-photo empty state.
function PhotoFrame({ src, alt = "", ratio = "4 / 3", radius = "var(--radius-lg)", border = true, style }) {
  return (
    <div style={{
      aspectRatio: ratio,
      background: "var(--paper-200)",
      borderRadius: radius,
      border: border ? "1px solid var(--paper-300)" : 0,
      overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      {src ? (
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
          color: "var(--ink-300)",
          fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "14px",
        }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="6" width="24" height="20" rx="2"/>
            <circle cx="12" cy="13" r="2"/>
            <path d="M4 22 L11 16 L17 21 L22 17 L28 22"/>
          </svg>
          <span>No photo yet</span>
        </div>
      )}
    </div>
  );
}

// ---------- STAR RATING ----------
// Saffron stars, per the design system (ratings = saffron highlight).
function StarRating({ value = 0, size = 18, showEmpty = true }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }} aria-label={`${value} out of 5`}>
      {stars.map((n) => {
        const filled = n <= value;
        if (!filled && !showEmpty) return null;
        return (
          <svg key={n} width={size} height={size} viewBox="0 0 24 24"
               fill={filled ? "var(--saffron-500)" : "none"}
               stroke={filled ? "var(--saffron-500)" : "var(--ink-300)"}
               strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 L14.5 8.7 L20.5 9.3 L16 13.4 L17.4 19.3 L12 16.1 L6.6 19.3 L8 13.4 L3.5 9.3 L9.5 8.7 Z"/>
          </svg>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  Icon, Button, Input, Textarea, Field, Tag, tagToneFor, Eyebrow, MetaRow, Toast, SprigDivider, PhotoFrame, StarRating,
});
