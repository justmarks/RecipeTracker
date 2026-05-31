// Top-level app — simulates routes via local state.

function App() {
  const [signedIn, setSignedIn] = useState(true);
  const [view, setView] = useState({ name: "list" });
  const [activeChapter, setActiveChapter] = useState("All");
  const [chapters, setChapters] = useState(window.MOCK_CHAPTERS);
  const [recipes, setRecipes] = useState(window.MOCK_RECIPES);
  const [parsedImport, setParsedImport] = useState(null);
  const [toast, setToast] = useState(null);
  const [favorites, setFavorites] = useState(() => new Set(["r2", "r7"]));

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setToast("Removed from favorites"); }
      else { next.add(id); setToast("Added to favorites"); }
      return next;
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Count recipes per chapter for the sidebar.
  const recipeCounts = recipes.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, { All: recipes.length });
  const favCount = recipes.filter((r) => favorites.has(r.id)).length;
  const orphanCount = recipes.filter((r) => !chapters.includes(r.category)).length;

  const goList = () => setView({ name: "list" });

  if (!signedIn) {
    return <SignInView onSignIn={() => setSignedIn(true)}/>;
  }

  let main;
  let overlay = null;
  if (view.name === "list") {
    main = (
      <RecipeListView
        recipes={recipes}
        chapters={chapters}
        activeChapter={activeChapter}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onPickRecipe={(r) => setView({ name: "detail", id: r.id })}
        onNew={() => setView({ name: "new" })}
        onImport={() => { setParsedImport(null); setView({ name: "import" }); }}
      />
    );
  } else if (view.name === "detail" || view.name === "share" || view.name === "confirmDelete") {
    const recipe = recipes.find((r) => r.id === view.id);
    main = (
      <RecipeDetail
        recipe={recipe}
        onBack={goList}
        onEdit={() => setView({ name: "edit", id: recipe.id })}
        onShare={() => setView({ name: "share", id: recipe.id })}
        onDelete={() => setView({ name: "confirmDelete", id: recipe.id })}
        onPdf={() => setToast("Opening print dialog…")}
        isFavorited={favorites.has(recipe.id)}
        onToggleFavorite={() => toggleFavorite(recipe.id)}
      />
    );
    if (view.name === "share") {
      overlay = <ShareDialog recipe={recipe} onClose={() => setView({ name: "detail", id: recipe.id })}/>;
    } else if (view.name === "confirmDelete") {
      overlay = (
        <ConfirmDialog
          title="Delete this recipe?"
          message={`"${recipe.title}" will be permanently removed from your cookbook. This can't be undone.`}
          onCancel={() => setView({ name: "detail", id: recipe.id })}
          onConfirm={() => {
            setRecipes(recipes.filter((r) => r.id !== recipe.id));
            setToast(`Deleted "${recipe.title}"`);
            goList();
          }}
        />
      );
    }
  } else if (view.name === "new") {
    main = (
      <RecipeForm
        chapters={chapters}
        onCancel={goList}
        onSubmit={(input) => {
          let source;
          if (input.sourceType === "url" && input.sourceUrl) {
            source = { type: "url", url: input.sourceUrl };
          } else if (input.sourceType === "book" && input.bookTitle) {
            source = { type: "book", title: input.bookTitle, author: input.bookAuthor || undefined, page: input.bookPage || undefined };
          }
          const newRecipe = {
            id: "r_" + Date.now(),
            title: input.title,
            category: input.category,
            tags: input.tags,
            photo: input.photo || undefined,
            rating: input.rating || undefined,
            lastMadeDate: input.lastMade || undefined,
            yield: input.yieldF, prepTime: input.prepTime, cookTime: input.cookTime, totalTime: input.totalTime,
            notes: input.notes || undefined,
            source,
            ingredients: [{ heading: null, items: input.ingredients.split("\n").filter(Boolean) }],
            instructions: [{ heading: null, items: input.instructions.split("\n").filter(Boolean) }],
          };
          setRecipes([newRecipe, ...recipes]);
          setToast(`Saved "${input.title || "recipe"}"`);
          setView({ name: "detail", id: newRecipe.id });
        }}
      />
    );
  } else if (view.name === "edit") {
    const recipe = recipes.find((r) => r.id === view.id);
    main = (
      <RecipeForm
        chapters={chapters}
        initial={recipe}
        submitLabel="Save changes"
        onCancel={() => setView({ name: "detail", id: recipe.id })}
        onSubmit={() => {
          setToast(`Saved changes to "${recipe.title}"`);
          setView({ name: "detail", id: recipe.id });
        }}
      />
    );
  } else if (view.name === "import") {
    if (parsedImport) {
      main = (
        <RecipeForm
          chapters={chapters}
          initial={parsedImport}
          submitLabel="Save imported recipe"
          banner="Claude returned the recipe below. Tweak anything that looks off, then save."
          onCancel={goList}
          onSubmit={() => { setToast(`Saved "${parsedImport.title}"`); goList(); setParsedImport(null); }}
        />
      );
    } else {
      main = <ImportView onBack={goList} onParsed={setParsedImport}/>;
    }
  } else if (view.name === "chapters") {
    main = (
      <ChaptersView
        chapters={chapters}
        onBack={goList}
        onChange={setChapters}
      />
    );
  } else if (view.name === "sharing") {
    main = <SharingView onBack={goList}/>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }}>
      <Sidebar
        chapters={chapters}
        activeChapter={activeChapter}
        recipeCounts={recipeCounts}
        favCount={favCount}
        orphanCount={orphanCount}
        onPickChapter={(c) => { setActiveChapter(c === activeChapter ? "All" : c); setView({ name: "list" }); }}
        onPickAll={() => { setActiveChapter("All"); setView({ name: "list" }); }}
        onPickFavorites={() => { setActiveChapter("Favorites"); setView({ name: "list" }); }}
        onPickOther={() => { setActiveChapter("Other"); setView({ name: "list" }); }}
        onHome={() => { setActiveChapter("All"); setView({ name: "list" }); }}
        onNew={() => setView({ name: "new" })}
        onImport={() => { setParsedImport(null); setView({ name: "import" }); }}
        onSettings={() => setView({ name: "chapters" })}
        onSharing={() => setView({ name: "sharing" })}
        onSignOut={() => setSignedIn(false)}
        user={window.MOCK_USER}
      />
      <main style={{ flex: 1, minWidth: 0 }}>
        {main}
      </main>
      {overlay}
      <Toast visible={!!toast}>{toast}</Toast>
    </div>
  );
}

window.App = App;
