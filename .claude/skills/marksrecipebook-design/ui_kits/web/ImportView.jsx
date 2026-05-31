// ImportView — URL → AI extract, or paste/upload markdown.

function ImportView({ onBack, onParsed, onSubmit }) {
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [parsing, setParsing] = useState(false);
  const [share, setShare] = useState(null); // {mode:"url"|"photo"} → full-page overlay

  const salmon = {
    title: "Sheet-pan miso salmon",
    category: "entree",
    tags: ["weeknight", "gluten-free"],
    source: { type: "url", url: urlInput || "https://example.com/miso-salmon" },
    yield: "4 servings", prepTime: "10 min", cookTime: "12 min", totalTime: "22 min",
    ingredients: [{ heading: null, items: [
      "4 salmon fillets", "3 tablespoons white miso", "2 tablespoons mirin",
      "1 tablespoon soy sauce", "1 tablespoon honey", "1 bunch broccolini",
    ]}],
    instructions: [{ heading: null, items: [
      "Heat oven to 220°C.",
      "Whisk miso, mirin, soy, honey.",
      "Brush onto salmon. Add broccolini to the sheet with a glug of oil.",
      "Roast 12 min until salmon flakes.",
    ]}],
  };

  // Share-target auto-fire → full-page overlay, then hand off to review form.
  const simulateShare = (mode) => {
    setShare({ mode });
    setTimeout(() => { setShare(null); onParsed(salmon); }, 1800);
  };

  const fakeFetch = async () => {
    setFetching(true);
    setTimeout(() => { setFetching(false); onParsed(salmon); }, 1100);
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

  const fakeImage = () => {
    onParsed({
      title: "Grandma's apple crumble",
      category: "dessert",
      tags: ["family", "fall"],
      yield: "8 servings",
      prepTime: "20 min",
      cookTime: "40 min",
      ingredients: [{ heading: null, items: [
        "6 apples, peeled and sliced",
        "1 cup flour",
        "1 cup oats",
        "¾ cup brown sugar",
        "½ cup butter, cold",
      ]}],
      instructions: [{ heading: null, items: [
        "Heat oven to 190°C.",
        "Toss apples with a little sugar and cinnamon; spread in a dish.",
        "Rub flour, oats, sugar, and butter into crumbs. Scatter over apples.",
        "Bake 40 min until golden and bubbling.",
      ]}],
    });
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "640px", margin: "0 auto" }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack}
              style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
        margin: "0 0 8px", letterSpacing: "-0.015em", color: "var(--ink-900)",
      }}>Import a recipe</h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: "0 0 16px" }}>
        Three ways to bring a recipe in. Any works — review the result before saving.
      </p>

      {/* Demo affordance: in production these fire automatically from the OS share sheet. */}
      <div style={{ marginBottom: "28px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => simulateShare("url")} style={demoLinkStyle}>
          <Icon name="share-2" size={13}/> Preview: shared link
        </button>
        <button type="button" onClick={() => simulateShare("photo")} style={demoLinkStyle}>
          <Icon name="image" size={13}/> Preview: shared photo
        </button>
      </div>

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
          eyebrowIcon="image"
          eyebrow="From a photo"
          hint="Snap a cookbook page or a handwritten card. Claude reads the text and extracts the recipe."
          actionLabel="Choose photo"
          actionIcon="upload"
          actionDisabled={false}
          onAction={fakeImage}
        >
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "8px", padding: "24px",
            border: "1.5px dashed var(--border-strong)", borderRadius: "var(--radius-md)",
            background: "var(--paper-50)", color: "var(--fg-subtle)",
          }}>
            <Icon name="image" size={28}/>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px" }}>Drag a photo here, or use the button below</span>
          </div>
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

      {share && <ImportOverlay mode={share.mode}/>}
    </div>
  );
}

const demoLinkStyle = {
  display: "inline-flex", alignItems: "center", gap: "6px",
  background: "transparent", border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius-pill)", padding: "5px 12px", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: "var(--fg-subtle)",
};

function ImportOverlay({ mode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(251, 246, 238, 0.96)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "20px", textAlign: "center", padding: "32px",
    }}>
      <style>{`@keyframes mfrb-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ color: "var(--tomato-500)", animation: "mfrb-spin 1.4s linear infinite", display: "flex" }}>
        <Icon name="sparkles" size={40}/>
      </div>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "30px", color: "var(--ink-900)", margin: "0 0 8px" }}>
          {mode === "photo" ? "Reading photo…" : "Importing recipe…"}
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--fg-muted)", margin: 0, maxWidth: "320px", lineHeight: 1.55 }}>
          {mode === "photo"
            ? "Claude is reading the text from your photo and pulling out the ingredients and steps."
            : "Claude is reading the page and pulling out the ingredients and steps."}
        </p>
      </div>
    </div>
  );
}

window.ImportView = ImportView;

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
