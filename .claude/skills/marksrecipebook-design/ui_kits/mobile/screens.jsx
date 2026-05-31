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
  const [fav, setFav] = mUseState(true);
  const [confirmDel, setConfirmDel] = mUseState(false);

  const FloatingButton = ({ icon, size = 17, onClick, filled = false, active = false }) => (
    <button onClick={onClick} style={{
      background: "rgba(251, 246, 238, 0.92)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: 0, width: 38, height: 38, borderRadius: 19,
      color: active ? "var(--tomato-600)" : "var(--ink-900)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(70,53,40,0.18)",
    }}>
      <MIcon name={icon} size={size} filled={filled}/>
    </button>
  );

  const ActionButton = ({ icon, label, danger, onClick }) => (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "10px 4px", borderRadius: 12,
      background: "var(--bg-card)", border: "1px solid var(--border-faint)",
      color: danger ? "var(--tomato-700)" : "var(--ink-700)", cursor: "pointer",
      fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
    }}>
      <MIcon name={icon} size={18}/>
      {label}
    </button>
  );

  return (
    <div style={{ height: "100%", background: "var(--bg-page)", overflowY: "auto", position: "relative" }}>
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

        {/* Floating buttons overlay: back (left), favorite (right) */}
        <div style={{
          position: "absolute", top: 56, left: 16, right: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <FloatingButton icon="chevron-left" size={18}/>
          <FloatingButton icon="heart" size={18} filled={fav} active={fav} onClick={() => setFav(!fav)}/>
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

        {/* Action row — Edit · Share · PDF · Delete (favorite is the floating heart) */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <ActionButton icon="pencil" label="Edit"/>
          <ActionButton icon="share" label="Share"/>
          <ActionButton icon="download" label="PDF"/>
          <ActionButton icon="trash" label="Delete" danger onClick={() => setConfirmDel(true)}/>
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

      {/* Confirm delete — bottom sheet */}
      {confirmDel && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setConfirmDel(false)} style={{ position: "absolute", inset: 0, background: "rgba(42,31,24,0.45)" }}/>
          <div style={{
            position: "relative", background: "var(--bg-card)",
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: "24px 20px 34px", boxShadow: "0 -8px 30px rgba(70,53,40,0.2)",
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)", margin: "0 auto 18px" }}/>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, color: "var(--ink-900)", margin: "0 0 8px" }}>Delete this recipe?</h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5, color: "var(--fg-muted)", margin: "0 0 20px" }}>
              &ldquo;{recipe.title}&rdquo; will be permanently removed from your cookbook. This can't be undone.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <MButton variant="primary" style={{ background: "var(--tomato-600)" }} onClick={() => setConfirmDel(false)}>Delete recipe</MButton>
              <MButton variant="secondary" onClick={() => setConfirmDel(false)}>Keep</MButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
// 4. IMPORT — three methods (URL / photo / markdown)
// ─────────────────────────────────────────────────────────────
function MImport() {
  const MethodCard = ({ icon, title, hint, children }) => (
    <div style={{
      background: "var(--bg-card)", padding: 16,
      borderRadius: 14, boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{
        fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11,
        textTransform: "uppercase", letterSpacing: "0.12em",
        color: "var(--tomato-600)", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <MIcon name={icon} size={12}/> {title}
      </div>
      {children}
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-subtle)", margin: "10px 0 0", lineHeight: 1.5 }}>{hint}</p>
    </div>
  );

  const fieldStyle = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    fontFamily: "var(--font-sans)", fontSize: 14,
    background: "var(--paper-100)", border: "1px solid var(--border-default)",
    borderRadius: 10, marginBottom: 10, outline: 0,
  };

  return (
    <div style={{ height: "100%", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <MHeader title="Import" eyebrow="URL · photo · markdown"/>
        <div style={{ padding: "0 20px 100px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55,
            color: "var(--fg-muted)", margin: "0 0 4px",
          }}>
            Three ways to bring a recipe in. Any works — review before saving.
          </p>

          <MethodCard icon="sparkles" title="From URL" hint="We fetch the page and ask Claude to extract the recipe.">
            <input placeholder="https://cooking.nytimes.com/…" style={fieldStyle}/>
            <MButton variant="primary" icon="sparkles">Fetch with AI</MButton>
          </MethodCard>

          <MethodCard icon="image" title="From a photo" hint="Snap a cookbook page or handwritten card. Claude reads the text.">
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, padding: 20, marginBottom: 10,
              border: "1.5px dashed var(--border-strong)", borderRadius: 10,
              background: "var(--paper-100)", color: "var(--fg-subtle)",
            }}>
              <MIcon name="image" size={26}/>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, textAlign: "center" }}>Tap to take a photo or choose from your library</span>
            </div>
            <MButton variant="secondary" icon="upload">Choose photo</MButton>
          </MethodCard>

          <MethodCard icon="file-text" title="From markdown" hint="Paste a markdown recipe. Use ## Headings for sections.">
            <textarea
              rows={5}
              placeholder={"# Title\n\n## Ingredients\n- 1 cup flour\n\n## Instructions\n1. Mix"}
              style={{ ...fieldStyle, fontFamily: "var(--font-mono)", fontSize: 13, resize: "vertical" }}
            />
            <MButton variant="secondary" icon="check">Parse markdown</MButton>
          </MethodCard>

          {/* iOS limitation banner */}
          <div style={{
            background: "var(--saffron-100)", color: "var(--saffron-700)",
            padding: "12px 14px", borderRadius: 12,
            fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <div style={{ flex: "0 0 18px", marginTop: 1 }}><MIcon name="link" size={16}/></div>
            <div>
              <strong style={{ fontWeight: 600 }}>iOS tip:</strong> iOS doesn't support "share to app". Copy a recipe URL from Safari, then paste it above.
            </div>
          </div>
        </div>
      </div>
      <MTabBar active="import"/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. YOU — iOS-style grouped settings (chapters · sharing · app)
// ─────────────────────────────────────────────────────────────
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

Object.assign(window, { MSignIn, MHome, MRecipeDetail, MImport, MYouSettings });
