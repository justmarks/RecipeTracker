// RecipeDetail — view a single recipe.

function RecipeDetail({ recipe, onBack, onEdit, onShare, onDelete, isFavorited, onToggleFavorite, onPdf }) {
  const hasTimes = recipe.yield || recipe.prepTime || recipe.cookTime || recipe.totalTime;
  const metaItems = [
    recipe.yield && { label: "Yield", value: recipe.yield },
    recipe.prepTime && { label: "Prep", value: recipe.prepTime },
    recipe.cookTime && { label: "Cook", value: recipe.cookTime },
    recipe.totalTime && { label: "Total", value: recipe.totalTime },
  ].filter(Boolean);

  // Action bar: Favorite · Edit · Share · PDF · Delete.
  // Labels collapse to icon-only under 640px (matches production's
  // `hidden sm:inline` pattern) via the `.rd-action-label` CSS below.
  const actions = (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <Button variant="secondary" size="sm" icon="heart" iconFilled={isFavorited}
              onClick={onToggleFavorite}
              aria-pressed={isFavorited}
              style={isFavorited ? { color: "var(--tomato-600)", borderColor: "var(--tomato-300)" } : undefined}>
        <span className="rd-action-label">{isFavorited ? "Favorited" : "Favorite"}</span>
      </Button>
      <Button variant="secondary" size="sm" icon="pencil" onClick={onEdit}>
        <span className="rd-action-label">Edit</span>
      </Button>
      <Button variant="secondary" size="sm" icon="share-2" onClick={onShare}>
        <span className="rd-action-label">Share</span>
      </Button>
      <Button variant="secondary" size="sm" icon="download" onClick={onPdf}>
        <span className="rd-action-label">PDF</span>
      </Button>
      <Button variant="danger" size="sm" icon="trash" onClick={onDelete}>
        <span className="rd-action-label">Delete</span>
      </Button>
    </div>
  );

  return (
    <div style={{ padding: "32px 40px", maxWidth: "720px", margin: "0 auto" }}>
      <style>{`@media (max-width: 640px) { .rd-action-label { display: none; } }`}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
        <Button variant="ghost" icon="arrow-left" onClick={onBack}
                style={{ padding: "4px 0" }}>Back</Button>
        {actions}
      </div>

      {/* Hero photo */}
      <PhotoFrame
        src={recipe.photo}
        alt={recipe.title}
        ratio="3 / 2"
        radius="var(--radius-xl)"
        style={{ marginBottom: "24px" }}
      />

      <Eyebrow style={{ textTransform: "uppercase" }}>{recipe.category}</Eyebrow>

      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "44px",
        lineHeight: 1.05, letterSpacing: "-0.02em",
        color: "var(--ink-900)", margin: "6px 0 0",
      }}>{recipe.title}</h1>

      {/* Rating + last made */}
      {(recipe.rating || recipe.lastMadeDate) && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
          {recipe.rating && <StarRating value={recipe.rating} size={20}/>}
          {recipe.rating && recipe.lastMadeDate && (
            <span style={{ width: "1px", height: "16px", background: "var(--border-default)" }}/>
          )}
          {recipe.lastMadeDate && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-subtle)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Icon name="clock" size={14}/>
              Last made {formatMadeDate(recipe.lastMadeDate)}
            </span>
          )}
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
          {recipe.tags.map((t) => <Tag key={t} tone={tagToneFor(t)}>{t}</Tag>)}
        </div>
      )}

      {recipe.source && recipe.source.type === "url" && (
        <div style={{ marginTop: "18px" }}>
          <a href={recipe.source.url} target="_blank" rel="noreferrer"
             style={{
               display: "inline-flex", alignItems: "center", gap: "7px",
               padding: "7px 12px",
               background: "transparent", border: "1px solid var(--border-strong)",
               borderRadius: "var(--radius-md)", textDecoration: "none",
               fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "13px",
               color: "var(--ink-700)",
               transition: "background var(--dur-fast), border-color var(--dur-fast)",
             }}
             onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
             onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <span style={{ color: "var(--tomato-600)", display: "flex" }}><Icon name="link" size={15}/></span>
            View source
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "12px", color: "var(--fg-subtle)" }}>
              {new URL(recipe.source.url).hostname.replace("www.", "")}
            </span>
          </a>
        </div>
      )}

      {recipe.source && recipe.source.type === "book" && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-subtle)", marginTop: "16px" }}>
          From <em style={{ fontFamily: "var(--font-display)" }}>{recipe.source.title}</em>
          {recipe.source.author && ` by ${recipe.source.author}`}
          {recipe.source.page && `, p. ${recipe.source.page}`}
        </p>
      )}

      {hasTimes && (
        <div style={{
          marginTop: "24px", padding: "16px 20px",
          background: "var(--paper-50)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-faint)",
        }}>
          <MetaRow items={metaItems}/>
        </div>
      )}

      <SprigDivider/>

      <section>
        <h2 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "24px",
          color: "var(--ink-900)", margin: "0 0 14px",
        }}>Ingredients</h2>
        {recipe.ingredients.map((sec, i) => (
          <div key={i} style={{ marginBottom: "16px" }}>
            {sec.heading && (
              <Eyebrow style={{ color: "var(--tomato-600)", marginBottom: "6px" }}>{sec.heading}</Eyebrow>
            )}
            <ul style={{
              fontFamily: "var(--font-sans)", fontSize: "15px", lineHeight: 1.7,
              color: "var(--ink-700)", margin: 0, padding: 0, listStyle: "none",
            }}>
              {sec.items.map((it, j) => (
                <li key={j} style={{ paddingLeft: "20px", position: "relative" }}>
                  <span style={{
                    position: "absolute", left: 0, top: "0.65em",
                    width: "6px", height: "6px", background: "var(--tomato-500)",
                    borderRadius: "50%",
                  }}/>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <SprigDivider/>

      <section>
        <h2 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "24px",
          color: "var(--ink-900)", margin: "0 0 14px",
        }}>Instructions</h2>
        {recipe.instructions.map((sec, i) => (
          <div key={i} style={{ marginBottom: "20px" }}>
            {sec.heading && (
              <Eyebrow style={{ color: "var(--tomato-600)", marginBottom: "8px" }}>{sec.heading}</Eyebrow>
            )}
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {sec.items.map((it, j) => (
                <li key={j} style={{
                  display: "flex", gap: "16px", marginBottom: "14px",
                  fontFamily: "var(--font-sans)", fontSize: "17px", lineHeight: 1.65,
                  color: "var(--ink-900)",
                }}>
                  <span style={{
                    flex: "0 0 28px",
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontWeight: 400, fontSize: "22px",
                    color: "var(--tomato-500)", lineHeight: 1.4,
                  }}>{j + 1}.</span>
                  <span>{it}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {recipe.notes && (
        <>
          <SprigDivider/>
          <section>
            <h2 style={{
              fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "24px",
              color: "var(--ink-900)", margin: "0 0 14px",
            }}>Notes</h2>
            <p style={{
              fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
              fontSize: "18px", lineHeight: 1.55, color: "var(--ink-700)",
              padding: "16px 20px", margin: 0,
              background: "var(--saffron-100)", borderRadius: "var(--radius-lg)",
              borderLeft: "3px solid var(--saffron-500)",
            }}>{recipe.notes}</p>
          </section>
        </>
      )}
    </div>
  );
}

function formatMadeDate(iso) {
  // iso = YYYY-MM-DD → "May 24, 2026"
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

window.RecipeDetail = RecipeDetail;
