// ImportView — URL → AI extract, or paste/upload markdown.

function ImportView({ onBack, onParsed, onSubmit }) {
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [parsing, setParsing] = useState(false);

  const fakeFetch = async () => {
    setFetching(true);
    setTimeout(() => {
      setFetching(false);
      onParsed({
        title: "Sheet-pan miso salmon",
        category: "entree",
        tags: ["weeknight", "gluten-free"],
        source: { type: "url", url: urlInput || "https://example.com/miso-salmon" },
        yield: "4 servings",
        prepTime: "10 min",
        cookTime: "12 min",
        totalTime: "22 min",
        ingredients: [{ heading: null, items: [
          "4 salmon fillets",
          "3 tablespoons white miso",
          "2 tablespoons mirin",
          "1 tablespoon soy sauce",
          "1 tablespoon honey",
          "1 bunch broccolini",
        ]}],
        instructions: [{ heading: null, items: [
          "Heat oven to 220°C.",
          "Whisk miso, mirin, soy, honey.",
          "Brush onto salmon. Add broccolini to the sheet with a glug of oil.",
          "Roast 12 min until salmon flakes.",
        ]}],
      });
    }, 1100);
  };

  const fakeParse = async () => {
    setParsing(true);
    setTimeout(() => {
      setParsing(false);
      onParsed({
        title: "Pasted recipe",
        category: "entree",
        tags: [],
        ingredients: [{ heading: null, items: ["From your markdown"] }],
        instructions: [{ heading: null, items: ["Step from your markdown"] }],
      });
    }, 600);
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "640px", margin: "0 auto" }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack}
              style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
        margin: "0 0 8px", letterSpacing: "-0.015em", color: "var(--ink-900)",
      }}>Import a recipe</h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 28px" }}>
        Two ways to bring a recipe in. Either works — review the result before saving.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <ImportCard
          eyebrowIcon="link"
          eyebrow="From URL"
          hint="We fetch the page and ask Claude to extract the recipe."
          actionLabel={fetching ? "Fetching…" : "Fetch with AI"}
          actionIcon="sparkles"
          actionDisabled={fetching || !urlInput.trim()}
          onAction={fakeFetch}
        >
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://cooking.nytimes.com/…"
            type="url"
            style={{ paddingRight: "20px" }}
          />
        </ImportCard>

        <ImportCard
          eyebrowIcon="file-text"
          eyebrow="From markdown"
          hint="Paste a markdown recipe. Use ## Headings for sections."
          actionLabel={parsing ? "Parsing…" : "Parse markdown"}
          actionIcon="check"
          actionDisabled={parsing || !markdown.trim()}
          onAction={fakeParse}
        >
          <Textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={6}
            mono
            placeholder={"# Title\n\n## Ingredients\n- 1 cup flour\n\n## Instructions\n1. Mix\n2. Bake"}
            style={{ paddingRight: "20px", minHeight: "190px" }}
          />
        </ImportCard>
      </div>
    </div>
  );
}

function ImportCard({ eyebrowIcon, eyebrow, hint, children, actionLabel, actionIcon, actionDisabled, onAction }) {
  return (
    <section style={{
      background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
      padding: "20px 24px", boxShadow: "var(--shadow-sm)",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <Eyebrow style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--tomato-600)" }}>
        <Icon name={eyebrowIcon} size={12}/>
        {eyebrow}
      </Eyebrow>
      {children}
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--fg-subtle)", margin: 0, lineHeight: 1.5 }}>
        {hint}
      </p>
      <div style={{ marginTop: "4px" }}>
        <Button variant="primary" icon={actionIcon} disabled={actionDisabled} onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}

window.ImportView = ImportView;
