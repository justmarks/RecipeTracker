// Mobile screens — five key flows, each rendered inside an IOSDevice frame.
// All consume the same mock data as the web kit.

// ─────────────────────────────────────────────────────────────
// 1. SIGN IN
// ─────────────────────────────────────────────────────────────
function MSignIn() {
  return (
    <div style={{
      height: "100%", background: "var(--bg-page)",
      display: "flex", flexDirection: "column",
      padding: "120px 24px 80px",
    }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <img src="../../assets/monogram.svg" width="84" height="84" style={{ margin: "0 auto", display: "block" }} alt=""/>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32,
          margin: "20px 0 0", lineHeight: 1, color: "var(--ink-900)",
        }}>Marks Family</h1>
        <div style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 26, color: "var(--tomato-500)", marginTop: 2,
        }}>Recipe Book</div>
      </div>
      <p style={{
        fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55,
        color: "var(--fg-muted)", textAlign: "center",
        margin: "0 0 40px",
      }}>
        Sign in to keep your recipes in one place.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MButton variant="primary">Continue with Google</MButton>
        <MButton variant="secondary">Continue with Microsoft</MButton>
      </div>
      <div style={{ flex: 1 }}/>
      <p style={{
        fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)",
        textAlign: "center", margin: 0,
      }}>
        Recipes live in your account. Shared recipes are visible only to people you choose.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. HOME — recipes list
// ─────────────────────────────────────────────────────────────
function MHome() {
  const recipes = window.MOCK_RECIPES;
  const chapters = window.MOCK_CHAPTERS;
  const groups = new Map(chapters.map((c) => [c, []]));
  recipes.forEach((r) => { if (groups.has(r.category)) groups.get(r.category).push(r); });

  return (
    <div style={{ height: "100%", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <MHeader
          title="Cookbook"
          eyebrow="6 chapters · 8 recipes"
          trailing={
            <button style={{
              background: "var(--tomato-500)", color: "#fff", border: 0,
              width: 36, height: 36, borderRadius: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MIcon name="plus" size={18}/>
            </button>
          }
        />

        {/* Search */}
        <div style={{ padding: "0 20px 16px", position: "relative" }}>
          <div style={{ position: "absolute", left: 32, top: "50%", transform: "translateY(-50%)", color: "var(--fg-subtle)" }}>
            <MIcon name="search" size={16}/>
          </div>
          <input placeholder="Search recipes…" style={{
            width: "100%", boxSizing: "border-box",
            padding: "12px 12px 12px 38px",
            fontFamily: "var(--font-sans)", fontSize: 15,
            background: "var(--paper-200)", color: "var(--ink-900)",
            border: 0, borderRadius: 10, outline: 0,
          }}/>
        </div>

        {/* Chapter sections */}
        <div style={{ padding: "0 0 100px" }}>
          {[...groups.entries()].map(([chapter, items]) => {
            if (items.length === 0) return null;
            return (
              <section key={chapter} style={{ marginTop: 20 }}>
                <h2 style={{
                  fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 20,
                  textTransform: "capitalize", color: "var(--ink-900)",
                  margin: "0 20px 8px", display: "flex", alignItems: "baseline", gap: 8,
                  paddingBottom: 6, borderBottom: "1px solid var(--border-default)",
                }}>
                  <span>{chapter}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", fontWeight: 400 }}>{items.length}</span>
                </h2>
                {items.map((r) => <MRecipeRow key={r.id} recipe={r}/>)}
              </section>
            );
          })}
        </div>
      </div>
      <MTabBar active="recipes"/>
    </div>
  );
}

function MRecipeRow({ recipe }) {
  return (
    <div style={{
      padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 12,
      borderBottom: "1px solid var(--border-faint)",
    }}>
      {/* Thumb */}
      <div style={{
        flex: "0 0 56px", width: 56, height: 56,
        borderRadius: 10, overflow: "hidden",
        background: "var(--paper-200)",
        border: "1px solid var(--paper-300)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {recipe.photo ? (
          <img src={recipe.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        ) : (
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" stroke="var(--ink-300)" strokeWidth="1.5">
            <rect x="4" y="6" width="24" height="20" rx="2"/>
            <circle cx="12" cy="13" r="2"/>
            <path d="M4 22 L11 16 L17 21 L22 17 L28 22"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 17,
          color: "var(--ink-900)", lineHeight: 1.2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{recipe.title}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
          {recipe.totalTime && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{recipe.totalTime}</span>
          )}
          {recipe.totalTime && recipe.tags.length > 0 && <span style={{ color: "var(--fg-faint)" }}>·</span>}
          {recipe.tags.slice(0, 2).map((t) => <MTag key={t} tone={mTagToneFor(t)}>{t}</MTag>)}
        </div>
      </div>
      <MIcon name="chevron-right" size={18} style={{ color: "var(--fg-faint)" }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. RECIPE DETAIL
// ─────────────────────────────────────────────────────────────
function MStarRating({ value = 0, size = 18 }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
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

function mFormatMadeDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

function MRecipeDetail() {
  const recipe = window.MOCK_RECIPES.find((r) => r.id === "r1"); // buttermilk pancakes — rating + URL source

  const FloatingButton = ({ icon, size = 17 }) => (
    <button style={{
      background: "rgba(251, 246, 238, 0.92)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: 0, width: 38, height: 38, borderRadius: 19,
      color: "var(--ink-900)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(70,53,40,0.18)",
    }}>
      <MIcon name={icon} size={size}/>
    </button>
  );

  return (
    <div style={{ height: "100%", background: "var(--bg-page)", overflowY: "auto" }}>
      {/* Hero photo — full-bleed at top */}
      <div style={{ position: "relative" }}>
        {recipe.photo ? (
          <img src={recipe.photo} alt="" style={{
            display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover",
          }}/>
        ) : (
          <div style={{
            width: "100%", aspectRatio: "4 / 3",
            background: "var(--paper-200)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ink-300)",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="6" width="24" height="20" rx="2"/>
                <circle cx="12" cy="13" r="2"/>
                <path d="M4 22 L11 16 L17 21 L22 17 L28 22"/>
              </svg>
              <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14 }}>No photo yet</span>
            </div>
          </div>
        )}

        {/* Floating buttons overlay */}
        <div style={{
          position: "absolute", top: 56, left: 16, right: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <FloatingButton icon="chevron-left" size={18}/>
          <div style={{ display: "flex", gap: 8 }}>
            <FloatingButton icon="share"/>
            <FloatingButton icon="pencil"/>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 100px" }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
          textTransform: "uppercase", letterSpacing: "0.12em",
          color: "var(--fg-subtle)",
        }}>{recipe.category}</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 34,
          lineHeight: 1.05, letterSpacing: "-0.02em",
          margin: "6px 0 0", color: "var(--ink-900)",
        }}>{recipe.title}</h1>

        {recipe.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {recipe.tags.map((t) => <MTag key={t} tone={mTagToneFor(t)}>{t}</MTag>)}
          </div>
        )}

        {/* Rating + last made */}
        {(recipe.rating || recipe.lastMadeDate) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {recipe.rating && <MStarRating value={recipe.rating} size={18}/>}
            {recipe.rating && recipe.lastMadeDate && (
              <span style={{ width: 1, height: 14, background: "var(--border-default)" }}/>
            )}
            {recipe.lastMadeDate && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MIcon name="clock" size={13}/>
                Last made {mFormatMadeDate(recipe.lastMadeDate)}
              </span>
            )}
          </div>
        )}

        {/* Source — URL button */}
        {recipe.source && recipe.source.type === "url" && (
          <div style={{ marginTop: 16 }}>
            <a href={recipe.source.url} target="_blank" rel="noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 12px",
              background: "transparent", border: "1px solid var(--border-strong)",
              borderRadius: 10, textDecoration: "none",
              fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13,
              color: "var(--ink-700)",
            }}>
              <span style={{ color: "var(--tomato-600)", display: "flex" }}><MIcon name="link" size={15}/></span>
              View source
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: 12, color: "var(--fg-subtle)" }}>
                {new URL(recipe.source.url).hostname.replace("www.", "")}
              </span>
            </a>
          </div>
        )}

        {/* Source — book */}
        {recipe.source && recipe.source.type === "book" && (
          <p style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
            fontSize: 14, color: "var(--fg-muted)", margin: "12px 0 0",
          }}>
            From {recipe.source.title}{recipe.source.author && ` by ${recipe.source.author}`}{recipe.source.page && `, p. ${recipe.source.page}`}
          </p>
        )}

        {/* Meta grid */}
        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: "var(--paper-50)", borderRadius: 14,
          border: "1px solid var(--border-faint)",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        }}>
          {[["Yield", recipe.yield], ["Prep", recipe.prepTime], ["Cook", recipe.cookTime], ["Total", recipe.totalTime]].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-subtle)" }}>{l}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-900)", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Sprig */}
        <div style={{ display: "flex", justifyContent: "center", margin: "24px 0" }}>
          <img src="../../assets/sprig-divider.svg" width="200" height="28" alt="" style={{ opacity: 0.9 }}/>
        </div>

        {/* Ingredients */}
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, color: "var(--ink-900)", margin: "0 0 12px" }}>Ingredients</h2>
        {recipe.ingredients.map((sec, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            {sec.heading && (
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--tomato-600)", marginBottom: 6 }}>{sec.heading}</div>
            )}
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {sec.items.map((it, j) => (
                <li key={j} style={{
                  position: "relative", paddingLeft: 20,
                  fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.65,
                  color: "var(--ink-700)",
                }}>
                  <span style={{ position: "absolute", left: 0, top: "0.65em", width: 6, height: 6, borderRadius: "50%", background: "var(--tomato-500)" }}/>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "center", margin: "24px 0" }}>
          <img src="../../assets/sprig-divider.svg" width="200" height="28" alt="" style={{ opacity: 0.9 }}/>
        </div>

        {/* Instructions */}
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, color: "var(--ink-900)", margin: "0 0 12px" }}>Instructions</h2>
        {recipe.instructions.map((sec, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {sec.heading && (
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--tomato-600)", marginBottom: 8 }}>{sec.heading}</div>
            )}
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {sec.items.map((it, j) => (
                <li key={j} style={{
                  display: "flex", gap: 14, marginBottom: 12,
                  fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.6,
                  color: "var(--ink-900)",
                }}>
                  <span style={{ flex: "0 0 24px", fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, fontSize: 20, color: "var(--tomato-500)" }}>{j + 1}.</span>
                  <span>{it}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}

        {recipe.notes && (
          <>
            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
              <img src="../../assets/sprig-divider.svg" width="200" height="28" alt="" style={{ opacity: 0.9 }}/>
            </div>
            <p style={{
              fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
              fontSize: 16, lineHeight: 1.55, color: "var(--ink-700)",
              padding: "14px 16px", margin: 0,
              background: "var(--saffron-100)", borderRadius: 14,
              borderLeft: "3px solid var(--saffron-500)",
            }}>{recipe.notes}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. IMPORT
// ─────────────────────────────────────────────────────────────
function MImport() {
  return (
    <div style={{ height: "100%", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <MHeader title="Import" eyebrow="From URL or markdown"/>
        <div style={{ padding: "0 20px 100px" }}>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55,
            color: "var(--fg-muted)", margin: "0 0 20px",
          }}>
            Paste a recipe URL. Claude will read the page and pull out the ingredients and steps.
          </p>

          <div style={{
            background: "var(--bg-card)", padding: "16px",
            borderRadius: 14, boxShadow: "var(--shadow-sm)",
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
              textTransform: "uppercase", letterSpacing: "0.12em",
              color: "var(--tomato-600)", marginBottom: 10,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <MIcon name="sparkles" size={12}/> AI from URL
            </div>
            <input placeholder="https://cooking.nytimes.com/…" style={{
              width: "100%", boxSizing: "border-box",
              padding: "12px 14px",
              fontFamily: "var(--font-sans)", fontSize: 14,
              background: "var(--paper-100)", border: "1px solid var(--border-default)",
              borderRadius: 10, marginBottom: 10, outline: 0,
            }}/>
            <MButton variant="primary" icon="sparkles">Fetch with AI</MButton>
          </div>

          {/* iOS limitation banner */}
          <div style={{
            background: "var(--saffron-100)", color: "var(--saffron-700)",
            padding: "12px 14px", borderRadius: 12,
            fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <div style={{ flex: "0 0 18px", marginTop: 1 }}><MIcon name="link" size={16}/></div>
            <div>
              <strong style={{ fontWeight: 600 }}>iOS tip:</strong> iOS doesn't support "share to app". Copy a recipe URL from Safari, then paste it here.
            </div>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 12, margin: "24px 0",
            color: "var(--fg-faint)", fontFamily: "var(--font-sans)", fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.12em",
          }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-default)" }}/>
            or paste markdown
            <div style={{ flex: 1, height: 1, background: "var(--border-default)" }}/>
          </div>

          <textarea
            rows={6}
            placeholder={"# Title\n\n## Ingredients\n- 1 cup flour\n\n## Instructions\n1. Mix\n2. Bake"}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "12px 14px",
              fontFamily: "var(--font-mono)", fontSize: 13,
              background: "var(--bg-card)", border: "1px solid var(--border-default)",
              borderRadius: 12, outline: 0, resize: "vertical",
            }}
          />
        </div>
      </div>
      <MTabBar active="import"/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. YOU — settings + chapters + auto-share
// ─────────────────────────────────────────────────────────────
function MYou() {
  return (
    <div style={{ height: "100%", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        <MHeader title="You" eyebrow="Account · sharing"/>
        <div style={{ padding: "0 20px" }}>
          {/* User card */}
          <div style={{
            background: "var(--bg-card)", padding: 16, borderRadius: 14,
            boxShadow: "var(--shadow-sm)",
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              background: "var(--olive-300)", color: "var(--olive-900)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20,
            }}>J</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 18, color: "var(--ink-900)" }}>Jess Marks</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-subtle)" }}>jess@marksfamily.test</div>
            </div>
          </div>
        </div>

        {/* Chapters section */}
        <MSection title="Chapters" hint="Reorder, rename, or add new ones. Recipes in renamed chapters move with them.">
          {window.MOCK_CHAPTERS.slice(0, 5).map((c, i) => (
            <MListRow key={c}
              leading={
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <MIcon name="chevron-up" size={12} style={{ color: "var(--fg-faint)" }}/>
                  <MIcon name="chevron-down" size={12} style={{ color: "var(--fg-faint)" }}/>
                </div>
              }
              label={c}
              trailing={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>{i + 1}</span>}
            />
          ))}
        </MSection>

        {/* Auto-share section */}
        <MSection title="Auto-share" hint="People here see every recipe you own — past and future. Revoke any time.">
          <MListRow leading={<MAvatar name="Mom" tone="tomato"/>} label="Susan Marks" sub="mom@marksfamily.test"/>
          <MListRow leading={<MAvatar name="Eli" tone="olive"/>} label="Eli Marks" sub="eli@marksfamily.test"/>
          <MListRow leading={<MAvatar name="+" tone="ghost"/>} label="Add someone" labelStyle={{ color: "var(--tomato-600)" }}/>
        </MSection>

      </div>
      <MTabBar active="you"/>
    </div>
  );
}

function MSection({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ padding: "0 20px", marginBottom: 8 }}>
        <h2 style={{
          fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
          textTransform: "uppercase", letterSpacing: "0.12em",
          color: "var(--fg-subtle)", margin: 0,
        }}>{title}</h2>
      </div>
      <div style={{
        background: "var(--bg-card)", margin: "0 16px",
        borderRadius: 14, overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
        border: "1px solid var(--border-faint)",
      }}>
        {children}
      </div>
      {hint && (
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)",
          padding: "8px 20px 0", margin: 0, lineHeight: 1.5,
        }}>{hint}</p>
      )}
    </div>
  );
}

function MListRow({ leading, label, sub, trailing, labelStyle }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: "1px solid var(--border-faint)",
      minHeight: 44,
    }}>
      <div style={{ flex: "0 0 auto" }}>{leading}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 15,
          color: "var(--ink-900)", textTransform: "capitalize",
          ...labelStyle,
        }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)" }}>{sub}</div>}
      </div>
      {trailing}
    </div>
  );
}

function MAvatar({ name, tone = "tomato" }) {
  const bg = tone === "tomato" ? "var(--tomato-100)"
           : tone === "olive"  ? "var(--olive-100)"
           : tone === "ghost"  ? "transparent"
           : "var(--paper-200)";
  const fg = tone === "tomato" ? "var(--tomato-700)"
           : tone === "olive"  ? "var(--olive-700)"
           : tone === "ghost"  ? "var(--tomato-600)"
           : "var(--ink-700)";
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 16,
      background: bg, color: fg,
      border: tone === "ghost" ? "1.5px dashed var(--tomato-300)" : 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14,
    }}>{name.charAt(0)}</div>
  );
}

// ═════════════════════════════════════════════════════════════
// VARIATION B — "Your cookbook" — narrative cover treatment
// ═════════════════════════════════════════════════════════════
function MYouCookbook() {
  return (
    <div style={{ height: "100%", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        {/* Hero: cookbook cover treatment */}
        <div style={{
          paddingTop: 80, paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
          textAlign: "center",
          background: "var(--paper-50)",
          borderBottom: "1px solid var(--border-faint)",
        }}>
          <img src="../../assets/monogram.svg" width={48} height={48} alt="" style={{ marginBottom: 12 }}/>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 32,
            letterSpacing: "-0.02em", color: "var(--ink-900)", lineHeight: 1,
          }}>Jess&rsquo;s</div>
          <div style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
            fontSize: 28, color: "var(--tomato-500)", marginTop: 2,
          }}>Recipe Book</div>
          <img src="../../assets/sprig-divider.svg" width={140} height={20} alt=""
               style={{ display: "block", margin: "16px auto 0", opacity: 0.8 }}/>
        </div>

        {/* Stats trio */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          padding: "20px 16px", gap: 8,
        }}>
          {[
            ["Recipes", "23"],
            ["Chapters", "7"],
            ["Family", "3"],
          ].map(([label, value]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28,
                color: "var(--ink-900)", lineHeight: 1,
              }}>{value}</div>
              <div style={{
                fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 10,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--fg-subtle)", marginTop: 6,
              }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Family — portrait pills */}
        <div style={{ padding: "0 20px", marginTop: 12 }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--fg-subtle)", marginBottom: 12,
          }}>Family</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { name: "Susan", tone: "tomato" },
              { name: "Eli", tone: "olive" },
              { name: "Dad", tone: "plum" },
            ].map((p) => (
              <div key={p.name} style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 28,
                  background: p.tone === "tomato" ? "var(--tomato-100)" : p.tone === "olive" ? "var(--olive-100)" : "var(--plum-100)",
                  color: p.tone === "tomato" ? "var(--tomato-700)" : p.tone === "olive" ? "var(--olive-700)" : "var(--plum-700)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22,
                  margin: "0 auto",
                }}>{p.name.charAt(0)}</div>
                <div style={{
                  fontFamily: "var(--font-sans)", fontSize: 12,
                  color: "var(--ink-700)", marginTop: 6,
                }}>{p.name}</div>
              </div>
            ))}
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                background: "transparent",
                border: "1.5px dashed var(--paper-400)",
                color: "var(--ink-300)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto",
              }}>
                <MIcon name="plus" size={20}/>
              </div>
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: 12,
                color: "var(--fg-subtle)", marginTop: 6,
              }}>Add</div>
            </div>
          </div>
        </div>

        {/* Library row */}
        <div style={{ padding: "32px 16px 0" }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: 14,
            border: "1px solid var(--border-faint)", overflow: "hidden",
          }}>
            <MListRow label="Manage chapters" trailing={<MIcon name="chevron-right" size={16} style={{ color: "var(--fg-faint)" }}/>}/>
            <MListRow label="Account · jess@marksfamily.test" labelStyle={{ textTransform: "none", color: "var(--fg-muted)", fontSize: 13 }}
              trailing={<span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--tomato-600)", fontWeight: 600 }}>Sign out</span>}/>
          </div>
        </div>
      </div>
      <MTabBar active="you"/>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// VARIATION C — "Profile" — personal, identity-forward
// ═════════════════════════════════════════════════════════════
function MYouProfile() {
  return (
    <div style={{ height: "100%", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        {/* Saffron banner */}
        <div style={{
          paddingTop: 70, paddingBottom: 60, paddingLeft: 24, paddingRight: 24,
          background: "linear-gradient(180deg, var(--saffron-100) 0%, var(--paper-100) 100%)",
          textAlign: "center",
          position: "relative",
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: 48,
            background: "var(--tomato-500)", color: "var(--paper-50)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 44,
            margin: "0 auto",
            boxShadow: "0 6px 18px rgba(70,53,40,0.15)",
            border: "3px solid var(--paper-100)",
          }}>J</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28,
            letterSpacing: "-0.015em", color: "var(--ink-900)",
            margin: "14px 0 4px",
          }}>Jess Marks</h1>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 13,
            color: "var(--fg-muted)",
          }}>jess@marksfamily.test</div>
          <div style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 13, color: "var(--fg-subtle)", marginTop: 8,
          }}>Cooking here since May 2026</div>
        </div>

        {/* Stat strip — sits half-overlapping the banner */}
        <div style={{ padding: "0 16px", marginTop: -28 }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: 14,
            boxShadow: "var(--shadow-md)",
            padding: "16px 0",
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          }}>
            {[
              ["Recipes", "23"],
              ["Shared", "18"],
              ["Family", "3"],
            ].map(([label, value], i) => (
              <div key={label} style={{
                textAlign: "center",
                borderRight: i < 2 ? "1px solid var(--border-faint)" : 0,
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, color: "var(--ink-900)", lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-subtle)", marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick action grid */}
        <div style={{ padding: "28px 16px 0" }}>
          <div style={{
            fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--fg-subtle)", padding: "0 4px 8px",
          }}>Manage</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "users", title: "Family sharing", sub: "3 people" },
              { icon: "book", title: "Chapters", sub: "7 sections" },
              { icon: "settings", title: "Preferences", sub: "Display & units" },
              { icon: "share", title: "Export", sub: "Markdown · PDF" },
            ].map((tile) => (
              <button key={tile.title} style={{
                all: "unset", cursor: "pointer",
                background: "var(--bg-card)", borderRadius: 14,
                padding: "14px 16px",
                boxShadow: "var(--shadow-xs)",
                border: "1px solid var(--border-faint)",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ color: "var(--tomato-500)" }}><MIcon name={tile.icon} size={20}/></div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--ink-900)" }}>{tile.title}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--fg-subtle)" }}>{tile.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sign out — quiet, at the bottom */}
        <div style={{ padding: "32px 16px 0", textAlign: "center" }}>
          <button style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14,
            color: "var(--tomato-600)", padding: 12,
          }}>Sign out</button>
        </div>
      </div>
      <MTabBar active="you"/>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// VARIATION D — "Settings" — pure iOS-style grouped list
// ═════════════════════════════════════════════════════════════
function MYouSettings() {
  return (
    <div style={{ height: "100%", background: "var(--paper-200)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        <MHeader title="You"/>

        {/* Profile row */}
        <div style={{ padding: "0 16px" }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: 14,
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 24,
                background: "var(--olive-300)", color: "var(--olive-900)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22,
              }}>J</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 16, color: "var(--ink-900)" }}>Jess Marks</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-subtle)" }}>jess@marksfamily.test</div>
              </div>
              <MIcon name="chevron-right" size={16} style={{ color: "var(--fg-faint)" }}/>
            </div>
          </div>
        </div>

        <SettingsSection label="Library">
          <SettingsRow icon="book" iconBg="var(--tomato-100)" iconFg="var(--tomato-700)" label="Chapters" trail="7"/>
          <SettingsRow icon="sparkles" iconBg="var(--saffron-100)" iconFg="var(--saffron-700)" label="Tags" trail="14"/>
          <SettingsRow icon="trash" iconBg="var(--paper-300)" iconFg="var(--ink-700)" label="Deleted recipes" trail="2"/>
        </SettingsSection>

        <SettingsSection label="Family sharing">
          <SettingsRow avatar="S" avatarTone="tomato" label="Susan Marks" sub="mom@marksfamily.test"/>
          <SettingsRow avatar="E" avatarTone="olive" label="Eli Marks" sub="eli@marksfamily.test"/>
          <SettingsRow icon="plus" iconBg="var(--tomato-50)" iconFg="var(--tomato-600)" label="Add someone" labelColor="var(--tomato-600)" labelWeight={600}/>
        </SettingsSection>

        <SettingsSection label="App">
          <SettingsRow icon="settings" iconBg="var(--paper-300)" iconFg="var(--ink-700)" label="Preferences"/>
          <SettingsRow icon="share" iconBg="var(--paper-300)" iconFg="var(--ink-700)" label="Help & feedback"/>
          <SettingsRow icon="link" iconBg="var(--paper-300)" iconFg="var(--ink-700)" label="Privacy" trail="v1.0.0"/>
        </SettingsSection>

        <SettingsSection>
          <SettingsRow icon="log-out" iconBg="var(--tomato-50)" iconFg="var(--tomato-700)" label="Sign out" labelColor="var(--tomato-700)" labelWeight={600} noChevron/>
        </SettingsSection>
      </div>
      <MTabBar active="you"/>
    </div>
  );
}

function SettingsSection({ label, children }) {
  return (
    <div style={{ marginTop: 24 }}>
      {label && (
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
          textTransform: "uppercase", letterSpacing: "0.12em",
          color: "var(--fg-subtle)",
          padding: "0 24px 8px",
        }}>{label}</div>
      )}
      <div style={{
        background: "var(--bg-card)",
        margin: "0 16px",
        borderRadius: 14, overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ icon, iconBg, iconFg, avatar, avatarTone, label, sub, trail, labelColor, labelWeight, noChevron }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px",
      borderBottom: "1px solid var(--border-faint)",
      minHeight: 48,
    }}>
      {avatar ? (
        <div style={{
          width: 30, height: 30, borderRadius: 15,
          background: avatarTone === "tomato" ? "var(--tomato-100)" : "var(--olive-100)",
          color:      avatarTone === "tomato" ? "var(--tomato-700)" : "var(--olive-700)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, flex: "0 0 30px",
        }}>{avatar}</div>
      ) : (
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: iconBg || "var(--paper-200)",
          color: iconFg || "var(--ink-700)",
          display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 30px",
        }}>
          <MIcon name={icon} size={16}/>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: labelWeight || 500, fontSize: 15,
          color: labelColor || "var(--ink-900)",
        }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)" }}>{sub}</div>}
      </div>
      {trail && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-subtle)" }}>{trail}</span>}
      {!noChevron && <MIcon name="chevron-right" size={16} style={{ color: "var(--fg-faint)" }}/>}
    </div>
  );
}

Object.assign(window, { MSignIn, MHome, MRecipeDetail, MImport, MYou, MYouCookbook, MYouProfile, MYouSettings });
