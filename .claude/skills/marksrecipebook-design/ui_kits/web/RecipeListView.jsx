// RecipeListView — the Home page. Search + grouped recipes, favorites, "Other".

function RecipeListView({ recipes, chapters, activeChapter, favorites, onToggleFavorite, onPickRecipe, onNew, onImport }) {
  const [search, setSearch] = useState("");

  // Collapsed-section state, persisted per session. A section is keyed by name.
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("mfrb_collapsed") || "{}"); }
    catch { return {}; }
  });
  const toggleCollapsed = (key) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { sessionStorage.setItem("mfrb_collapsed", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const tokens = search.toLowerCase().split(/\s+/).filter((s) => s.length >= 2);
  const searching = tokens.length > 0;

  const orphanChapters = new Set(chapters);
  const isOrphan = (r) => !orphanChapters.has(r.category);

  const matchesSearch = (r) => {
    if (!searching) return true;
    const haystack = [r.title.toLowerCase(), ...r.tags, r.category,
      ...r.ingredients.flatMap((s) => s.items.join(" ").toLowerCase().split(/\s+/))].join(" ");
    return tokens.every((t) => haystack.includes(t));
  };

  // Build the list for the active scope.
  let scoped;
  if (activeChapter === "Favorites") {
    scoped = recipes.filter((r) => favorites.has(r.id)).filter(matchesSearch)
      .sort((a, b) => a.title.localeCompare(b.title));
  } else if (activeChapter === "Other") {
    scoped = recipes.filter(isOrphan).filter(matchesSearch);
  } else if (activeChapter === "All") {
    scoped = recipes.filter(matchesSearch);
  } else {
    scoped = recipes.filter((r) => r.category === activeChapter).filter(matchesSearch);
  }

  const title = activeChapter === "All" ? "All recipes" : activeChapter;
  const isFavView = activeChapter === "Favorites";

  // Home (unscoped, no search) shows the rich layout: Recently added → Favorites → chapters → Other.
  const isHome = activeChapter === "All";

  const rowProps = { favorites, onToggleFavorite, onPickRecipe };

  // Group helper, preserving chapter order.
  const groupByChapter = (list) => {
    const groups = new Map(chapters.map((c) => [c, []]));
    for (const r of list) if (groups.has(r.category)) groups.get(r.category).push(r);
    return groups;
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "880px", margin: "0 auto" }}>
      <header style={{ marginBottom: "24px" }}>
        <Eyebrow>{isFavView ? "Saved" : "Cookbook"}</Eyebrow>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "20px", marginTop: "4px" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
            margin: 0, letterSpacing: "-0.015em", color: "var(--ink-900)",
            textTransform: activeChapter === "All" || isFavView || activeChapter === "Other" ? "none" : "capitalize",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            flex: 1, minWidth: 0,
          }}>
            {title}
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

      {scoped.length === 0 ? (
        <EmptyState search={search} favView={isFavView}/>
      ) : isHome ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {!searching && (
            <CollapsibleSection
              name="Recently added" italic count={null}
              collapsed={collapsed["Recently added"]} onToggle={() => toggleCollapsed("Recently added")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", paddingTop: "4px" }}>
                {recipes.slice(0, 4).map((r) => (
                  <RecipeCard key={r.id} recipe={r} onPick={() => onPickRecipe(r)}
                              isFavorited={favorites.has(r.id)} onToggleFavorite={() => onToggleFavorite(r.id)}/>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {recipes.some((r) => favorites.has(r.id)) && (
            <CollapsibleSection
              name="Favorites" icon="heart" count={recipes.filter((r) => favorites.has(r.id)).length}
              forceOpen={searching} collapsed={collapsed["Favorites"]} onToggle={() => toggleCollapsed("Favorites")}>
              {recipes.filter((r) => favorites.has(r.id)).filter(matchesSearch)
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((r) => <RecipeRow key={r.id} recipe={r} {...rowProps}/>)}
            </CollapsibleSection>
          )}

          {[...groupByChapter(recipes.filter(matchesSearch)).entries()].map(([c, items]) => {
            if (items.length === 0) return null;
            return (
              <CollapsibleSection key={c} name={c} capitalize count={items.length}
                forceOpen={searching} collapsed={collapsed[c]} onToggle={() => toggleCollapsed(c)}>
                {items.map((r) => <RecipeRow key={r.id} recipe={r} {...rowProps}/>)}
              </CollapsibleSection>
            );
          })}

          {recipes.filter(isOrphan).filter(matchesSearch).length > 0 && (
            <CollapsibleSection name="Other" italic count={recipes.filter(isOrphan).length}
              forceOpen={searching} collapsed={collapsed["Other"]} onToggle={() => toggleCollapsed("Other")}>
              {recipes.filter(isOrphan).filter(matchesSearch).map((r) => <RecipeRow key={r.id} recipe={r} {...rowProps}/>)}
            </CollapsibleSection>
          )}
        </div>
      ) : (
        // Scoped views (single chapter, Favorites-only, Other-only): flat list.
        <div style={{ display: "flex", flexDirection: "column" }}>
          {scoped.map((r) => <RecipeRow key={r.id} recipe={r} {...rowProps}/>)}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ name, count, icon, italic, capitalize, collapsed, forceOpen, onToggle, children }) {
  const open = forceOpen || !collapsed;
  return (
    <section>
      <button onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: "10px", width: "100%",
        background: "transparent", border: 0, cursor: "pointer", textAlign: "left",
        margin: "0 0 12px", paddingBottom: "8px",
        borderBottom: "1px solid var(--border-default)",
      }}>
        <span style={{
          display: "inline-flex", flexShrink: 0, color: "var(--fg-faint)",
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
        }}>
          <Icon name="chevron-right" size={16}/>
        </span>
        {icon && <Icon name={icon} size={16} filled={icon === "heart"} style={{ color: "var(--tomato-500)" }}/>}
        <h2 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "22px",
          color: "var(--ink-900)", margin: 0, lineHeight: 1.1,
          fontStyle: italic ? "italic" : "normal",
          textTransform: capitalize ? "capitalize" : "none",
        }}>{name}</h2>
        {count != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-faint)" }}>{count}</span>
        )}
      </button>
      {open && <div style={{ display: name === "Recently added" ? "block" : "flex", flexDirection: "column", marginBottom: "4px" }}>{children}</div>}
    </section>
  );
}

function RecipeCard({ recipe, onPick, isFavorited, onToggleFavorite }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: "pointer", display: "flex", flexDirection: "column",
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
      }}>
      <div style={{ position: "relative" }}>
        <PhotoFrame src={recipe.photo} alt={recipe.title} ratio="4 / 3" radius="0" border={false}/>
        <div style={{
          position: "absolute", top: "6px", right: "6px",
          background: "rgba(251,246,238,0.86)", borderRadius: "var(--radius-pill)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}>
          <FavoriteToggle active={isFavorited} onToggle={onToggleFavorite} size={16}/>
        </div>
      </div>
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
    </div>
  );
}

function EmptyState({ search, favView }) {
  if (favView && !search) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <Icon name="heart" size={32} style={{ color: "var(--ink-300)", margin: "0 auto 12px" }}/>
        <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "22px", color: "var(--fg-muted)", margin: 0 }}>
          No favorites yet.
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-subtle)", margin: "8px auto 0", maxWidth: "320px", lineHeight: 1.5 }}>
          Tap the heart on any recipe to keep it within easy reach here.
        </p>
      </div>
    );
  }
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

function RecipeRow({ recipe, favorites, onToggleFavorite, onPickRecipe }) {
  const [hover, setHover] = useState(false);
  const isFav = favorites.has(recipe.id);
  return (
    <div
      onClick={() => onPickRecipe(recipe)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "16px",
        width: "100%", textAlign: "left",
        background: hover ? "var(--paper-200)" : "transparent",
        borderBottom: "1px solid var(--border-faint)",
        padding: "14px 12px", margin: 0,
        cursor: "pointer", borderRadius: hover ? "var(--radius-md)" : 0,
        transition: "background var(--dur-fast)",
      }}>
      <PhotoFrame
        src={recipe.photo}
        alt=""
        ratio="1 / 1"
        radius="10px"
        showCaption={false}
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
          {recipe.sharedBy && <SharedPill/>}
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
          {(recipe.totalTime || recipe.rating || recipe.lastMadeDate || recipe.sharedBy) && recipe.tags.length > 0 && (
            <span style={{ color: "var(--fg-faint)", fontSize: "11px" }}>·</span>
          )}
          {recipe.tags.map((t) => <Tag key={t} tone={tagToneFor(t)}>{t}</Tag>)}
        </div>
      </div>
      <FavoriteToggle active={isFav} onToggle={() => onToggleFavorite(recipe.id)} size={18}/>
      <Icon name="chevron-right" size={18} style={{ color: "var(--fg-faint)", flex: "0 0 18px" }}/>
    </div>
  );
}

function shortMadeDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

window.RecipeListView = RecipeListView;
