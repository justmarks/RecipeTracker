// RecipeDetail — view a single recipe.

function RecipeDetail({ recipe, onBack, onEdit, onShare }) {
  const hasTimes = recipe.yield || recipe.prepTime || recipe.cookTime || recipe.totalTime;
  const metaItems = [
    recipe.yield && { label: "Yield", value: recipe.yield },
    recipe.prepTime && { label: "Prep", value: recipe.prepTime },
    recipe.cookTime && { label: "Cook", value: recipe.cookTime },
    recipe.totalTime && { label: "Total", value: recipe.totalTime },
  ].filter(Boolean);

  return (
    <div style={{ padding: "32px 40px", maxWidth: "720px", margin: "0 auto" }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack}
              style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

      {/* Hero photo */}
      <PhotoFrame
        src={recipe.photo}
        alt={recipe.title}
        ratio="3 / 2"
        radius="var(--radius-xl)"
        style={{ marginBottom: "24px" }}
      />

      <Eyebrow style={{ textTransform: "uppercase" }}>{recipe.category}</Eyebrow>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginTop: "6px" }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "44px",
          lineHeight: 1.05, letterSpacing: "-0.02em",
          color: "var(--ink-900)", margin: 0, flex: 1,
        }}>{recipe.title}</h1>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <Button variant="secondary" icon="share" size="sm" onClick={onShare}>Share</Button>
          <Button variant="secondary" icon="pencil" size="sm" onClick={onEdit}>Edit</Button>
        </div>
      </div>

      {recipe.tags.length > 0 && (
        <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
          {recipe.tags.map((t) => <Tag key={t} tone={tagToneFor(t)}>{t}</Tag>)}
        </div>
      )}

      {recipe.source && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-subtle)", marginTop: "16px" }}>
          {recipe.source.type === "url" ? (
            <a href={recipe.source.url} target="_blank" rel="noreferrer"
               style={{ color: "var(--fg-link)" }}>
              <Icon name="link" size={12} style={{ verticalAlign: "-2px", marginRight: "4px" }}/>
              {new URL(recipe.source.url).hostname.replace("www.", "")}
            </a>
          ) : (
            <span>
              From <em style={{ fontFamily: "var(--font-display)" }}>{recipe.source.title}</em>
              {recipe.source.author && ` by ${recipe.source.author}`}
              {recipe.source.page && `, p. ${recipe.source.page}`}
            </span>
          )}
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

window.RecipeDetail = RecipeDetail;
