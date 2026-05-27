// Top-level app — simulates routes via local state.

function App() {
  const [signedIn, setSignedIn] = useState(true);
  const [view, setView] = useState({ name: "list" });
  const [activeChapter, setActiveChapter] = useState("All");
  const [chapters, setChapters] = useState(window.MOCK_CHAPTERS);
  const [recipes, setRecipes] = useState(window.MOCK_RECIPES);
  const [parsedImport, setParsedImport] = useState(null);
  const [toast, setToast] = useState(null);

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

  const goList = () => setView({ name: "list" });

  if (!signedIn) {
    return <SignInView onSignIn={() => setSignedIn(true)}/>;
  }

  let main;
  if (view.name === "list") {
    main = (
      <RecipeListView
        recipes={recipes}
        chapters={activeChapter === "All" ? chapters : [activeChapter]}
        activeChapter={activeChapter}
        onPickRecipe={(r) => setView({ name: "detail", id: r.id })}
        onNew={() => setView({ name: "new" })}
        onImport={() => { setParsedImport(null); setView({ name: "import" }); }}
      />
    );
  } else if (view.name === "detail") {
    const recipe = recipes.find((r) => r.id === view.id);
    main = (
      <RecipeDetail
        recipe={recipe}
        onBack={goList}
        onEdit={() => setView({ name: "edit", id: recipe.id })}
        onShare={() => setToast(`Shared "${recipe.title}" with the family`)}
      />
    );
  } else if (view.name === "new") {
    main = (
      <RecipeForm
        chapters={chapters}
        onCancel={goList}
        onSubmit={(input) => {
          const newRecipe = {
            id: "r_" + Date.now(),
            title: input.title,
            category: input.category,
            tags: input.tags,
            yield: input.yieldF, prepTime: input.prepTime, cookTime: input.cookTime, totalTime: input.totalTime,
            notes: input.notes || undefined,
            source: input.sourceUrl ? { type: "url", url: input.sourceUrl } : undefined,
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
          banner="Review the parsed recipe below and save when you're happy with it."
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
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }}>
      <Sidebar
        chapters={chapters}
        activeChapter={activeChapter}
        recipeCounts={recipeCounts}
        onPickChapter={(c) => { setActiveChapter(c === activeChapter ? "All" : c); setView({ name: "list" }); }}
        onNew={() => setView({ name: "new" })}
        onImport={() => { setParsedImport(null); setView({ name: "import" }); }}
        onSettings={() => setView({ name: "chapters" })}
        onSignOut={() => setSignedIn(false)}
        user={window.MOCK_USER}
      />
      <main style={{ flex: 1, minWidth: 0 }}>
        {main}
      </main>
      <Toast visible={!!toast}>{toast}</Toast>
    </div>
  );
}

window.App = App;
