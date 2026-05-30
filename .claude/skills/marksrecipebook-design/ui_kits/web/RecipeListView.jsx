// RecipeListView — the Home page. Search + recipes grouped by chapter.

function RecipeListView({ recipes, chapters, activeChapter, onPickRecipe, onNew, onImport }) {
  const [search, setSearch] = useState("");

  const tokens = search.toLowerCase().split(/\s+/).filter((s) => s.length >= 2);

  const filtered = recipes.filter((r) => {
    if (activeChapter !== "All" && r.category !== activeChapter) return false;
    if (tokens.length === 0) return true;
    const haystack = [r.title.toLowerCase(), ...r.tags, r.category,
      ...r.ingredients.flatMap((s) => s.items.join(" ").toLowerCase().split(/\s+/))].join(" ");
    return tokens.every((t) => haystack.includes(t));
  });

  // Group by chapter, preserving the user's chapter order.
  const groups = new Map();
  for (const c of chapters) groups.set(c, []);
  for (const r of filtered) {
    if (groups.has(r.category)) groups.get(r.category).push(r);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: "880px", margin: "0 auto" }}>
      <header style={{ marginBottom: "24px" }}>
        <Eyebrow>Cookbook</Eyebrow>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "20px", marginTop: "4px" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
            margin: 0, letterSpacing: "-0.015em", color: "var(--ink-900)",
            textTransform: "capitalize", whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
            flex: 1, minWidth: 0,
          }}>
            {activeChapter === "All" ? "All recipes" : activeChapter}
          </h1>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <Button variant="secondary" icon="sparkles" onClick={onImport}>Import</Button>
            <Button variant="primary" icon="plus" onClick={onNew}>New recipe</Button>
          </div>
        </div>
      </header>

      <div style={{ position: "relative", marginBottom: "32px" }}>
        <div style={{
          position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
          color: "var(--fg-subtle)", pointerEvents: "none",
        }}>
          <Icon name="search" size={16}/>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or ingredient…"
          style={{ paddingLeft: "40px" }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{
            position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: 0, cursor: "pointer", color: "var(--fg-subtle)",
            padding: "4px",
          }} aria-label="Clear search">
            <Icon name="x" size={14}/>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState search={search}/>
      ) : (
        <>
          {activeChapter === "All" && !search && (
            <RecentlyAdded recipes={recipes} onPickRecipe={onPickRecipe}/>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
            {chapters.map((c) => {
              const items = groups.get(c) || [];
              if (items.length === 0) return null;
              return <ChapterSection key={c} name={c} recipes={items} onPickRecipe={onPickRecipe}/>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RecentlyAdded({ recipes, onPickRecipe }) {
  // Take first 4 as "recently added"
  const featured = recipes.slice(0, 4);
  return (
    <section style={{ marginBottom: "40px" }}>
      <h2 style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "22px",
        color: "var(--ink-900)", fontStyle: "italic",
        margin: "0 0 16px", whiteSpace: "nowrap",
      }}>
        Recently added
      </h2>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px",
      }}>
        {featured.map((r) => <RecipeCard key={r.id} recipe={r} onPick={() => onPickRecipe(r)}/>)}
      </div>
    </section>
  );
}

function RecipeCard({ recipe, onPick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onPick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
              background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
              transition: "box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
              transform: hover ? "translateY(-1px)" : "translateY(0)",
              textAlign: "left",
            }}>
      <PhotoFrame src={recipe.photo} alt={recipe.title} ratio="4 / 3" radius="0" border={false}/>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: "2px" }}>
        <Eyebrow style={{ textTransform: "uppercase" }}>{recipe.category}</Eyebrow>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "17px",
          color: "var(--ink-900)", lineHeight: 1.2, letterSpacing: "-0.005em",
          marginTop: "2px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{recipe.title}</div>
        {(recipe.rating || recipe.totalTime) && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
            {recipe.rating && <StarRating value={recipe.rating} size={13} showEmpty={false}/>}
            {recipe.rating && recipe.totalTime && (
              <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>·</span>
            )}
            {recipe.totalTime && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-subtle)" }}>
                {recipe.totalTime}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function EmptyState({ search }) {
  if (search) {
    return (
      <p style={{ fontFamily: "var(--font-sans)", color: "var(--fg-muted)", textAlign: "center", padding: "48px 0" }}>
        No recipes match &ldquo;{search}&rdquo;.
      </p>
    );
  }
  return (
    <div style={{ textAlign: "center", padding: "64px 0" }}>
      <img src="../../assets/sprig-divider.svg" width="200" height="32" alt="" style={{ opacity: 0.5, marginBottom: "16px" }}/>
      <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "22px", color: "var(--fg-muted)", margin: 0 }}>
        No recipes yet.
      </p>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-subtle)", margin: "8px 0 0" }}>
        Create one to get started.
      </p>
    </div>
  );
}

function ChapterSection({ name, recipes, onPickRecipe }) {
  return (
    <section>
      <h2 style={{
        display: "flex", alignItems: "baseline", gap: "10px",
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "22px",
        color: "var(--ink-900)", textTransform: "capitalize",
        margin: "0 0 12px", paddingBottom: "8px",
        borderBottom: "1px solid var(--border-default)",
      }}>
        <span>{name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-faint)", fontWeight: 400 }}>
          {recipes.length}
        </span>
      </h2>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {recipes.map((r) => <RecipeRow key={r.id} recipe={r} onPick={() => onPickRecipe(r)}/>)}
      </div>
    </section>
  );
}

function RecipeRow({ recipe, onPick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onPick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              display: "flex", alignItems: "center", gap: "16px",
              width: "100%", textAlign: "left",
              background: hover ? "var(--paper-200)" : "transparent",
              border: 0, borderBottom: "1px solid var(--border-faint)",
              padding: "14px 12px", margin: 0,
              cursor: "pointer", borderRadius: hover ? "var(--radius-md)" : 0,
              transition: "background var(--dur-fast)",
            }}>
      <PhotoFrame
        src={recipe.photo}
        alt=""
        ratio="1 / 1"
        radius="10px"
        style={{ flex: "0 0 64px", width: "64px", height: "64px" }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "18px",
          color: "var(--ink-900)", letterSpacing: "-0.005em",
          marginBottom: "3px",
        }}>
          {recipe.title}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {recipe.rating && <StarRating value={recipe.rating} size={14} showEmpty={false}/>}
          {recipe.rating && recipe.totalTime && (
            <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>·</span>
          )}
          {recipe.totalTime && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-subtle)" }}>
              {recipe.totalTime}
            </span>
          )}
          {recipe.lastMadeDate && (
            <>
              <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>·</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--fg-subtle)" }}>
                made {shortMadeDate(recipe.lastMadeDate)}
              </span>
            </>
          )}
          {(recipe.totalTime || recipe.rating || recipe.lastMadeDate) && recipe.tags.length > 0 && (
            <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>·</span>
          )}
          {recipe.tags.map((t) => <Tag key={t} tone={tagToneFor(t)}>{t}</Tag>)}
        </div>
      </div>
      <Icon name="chevron-right" size={18} style={{ color: "var(--fg-faint)", flex: "0 0 18px" }}/>
    </button>
  );
}

function shortMadeDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

window.RecipeListView = RecipeListView;
