// RecipeForm — create / edit / import preview. Shape matches RecipeInput.

function RecipeForm({ initial = {}, chapters, onCancel, onSubmit, submitLabel = "Save recipe", banner }) {
  const [title, setTitle] = useState(initial.title || "");
  const [category, setCategory] = useState(initial.category || chapters[0] || "");
  const [tagsInput, setTagsInput] = useState((initial.tags || []).join(", "));
  const [sourceType, setSourceType] = useState(initial.source?.type === "book" ? "book" : "url");
  const [sourceUrl, setSourceUrl] = useState(initial.source?.type === "url" ? initial.source.url : "");
  const [bookTitle, setBookTitle] = useState(initial.source?.type === "book" ? initial.source.title : "");
  const [bookAuthor, setBookAuthor] = useState(initial.source?.type === "book" ? (initial.source.author || "") : "");
  const [bookPage, setBookPage] = useState(initial.source?.type === "book" ? (initial.source.page || "") : "");
  const [photo, setPhoto] = useState(initial.photo || "");
  const [rating, setRating] = useState(initial.rating || 0);
  const [lastMade, setLastMade] = useState(initial.lastMadeDate || "");
  const [ingredients, setIngredients] = useState(
    initial.ingredients ? sectionsToText(initial.ingredients) : ""
  );
  const [instructions, setInstructions] = useState(
    initial.instructions ? sectionsToText(initial.instructions) : ""
  );
  const [yieldF, setYieldF] = useState(initial.yield || "");
  const [prepTime, setPrepTime] = useState(initial.prepTime || "");
  const [cookTime, setCookTime] = useState(initial.cookTime || "");
  const [totalTime, setTotalTime] = useState(initial.totalTime || "");
  const [notes, setNotes] = useState(initial.notes || "");

  // Simulate a file upload → Storage URL.
  const fileRef = React.useRef(null);
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setPhoto(URL.createObjectURL(f)); // in production: upload to Storage, store the returned URL
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ title, category, tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean), sourceType, sourceUrl, bookTitle, bookAuthor, bookPage, photo, rating, lastMade, ingredients, instructions, yieldF, prepTime, cookTime, totalTime, notes });
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: "720px", margin: "0 auto", paddingBottom: "100px" }}>
      <div style={{ padding: "32px 40px 0" }}>
        <Button variant="ghost" icon="arrow-left" onClick={onCancel} type="button"
                style={{ padding: "4px 0", marginBottom: "16px" }}>Back</Button>

        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "38px",
          margin: "0 0 20px", letterSpacing: "-0.015em", color: "var(--ink-900)",
        }}>{initial.title ? "Edit recipe" : "New recipe"}</h1>

        {banner && (
          <div style={{
            padding: "12px 14px", borderRadius: "var(--radius-md)",
            background: "var(--saffron-100)", color: "var(--saffron-700)",
            fontFamily: "var(--font-sans)", fontSize: "13px",
            marginBottom: "20px",
            display: "flex", gap: "10px", alignItems: "flex-start",
          }}>
            <Icon name="sparkles" size={16} style={{ flex: "0 0 16px", marginTop: "1px" }}/>
            <span>{banner}</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required/>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Chapter">
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "14px",
                  background: "var(--bg-card)", color: "var(--fg-default)",
                  border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)",
                  padding: "10px 12px", width: "100%", textTransform: "capitalize",
                }}>
                {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Tags (comma-separated)">
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vegetarian, weekend"/>
            </Field>
          </div>

          {/* Source: URL or book reference */}
          <Field label="Source">
            <Segmented
              value={sourceType}
              onChange={setSourceType}
              options={[{ value: "url", label: "URL" }, { value: "book", label: "Book" }]}
            />
            {sourceType === "url" ? (
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url"
                     placeholder="https://..." style={{ marginTop: "10px" }}/>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 0.8fr", gap: "10px", marginTop: "10px" }}>
                <Input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Book title"/>
                <Input value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} placeholder="Author"/>
                <Input value={bookPage} onChange={(e) => setBookPage(e.target.value)} placeholder="Page"/>
              </div>
            )}
          </Field>

          {/* Photo: URL or upload, with thumbnail preview */}
          <Field label="Photo" hint="Paste an image URL, or upload a photo of the dish.">
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://… or upload →"/>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }}/>
              <Button type="button" variant="secondary" icon="upload" onClick={() => fileRef.current && fileRef.current.click()}>
                Choose file
              </Button>
            </div>
            {photo && (
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                <PhotoFrame src={photo} alt="" ratio="1 / 1" radius="var(--radius-sm)"
                            style={{ width: "56px", height: "56px", flex: "0 0 56px" }}/>
                <button type="button" onClick={() => setPhoto("")} style={{
                  background: "transparent", border: 0, cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--tomato-700)",
                }}>Remove photo</button>
              </div>
            )}
          </Field>

          {/* Rating + last made */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", alignItems: "start" }}>
            <Field label="Rating">
              <div style={{ paddingTop: "2px" }}><StarRatingInput value={rating} onChange={setRating} size={26}/></div>
            </Field>
            <Field label="Last made" hint="Optional — when you last cooked it.">
              <Input value={lastMade} onChange={(e) => setLastMade(e.target.value)} type="date"/>
            </Field>
          </div>

          <Field label="Ingredients" hint="One per line. Use ## Heading for sections.">
            <Textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={8} mono/>
          </Field>

          <Field label="Instructions" hint="One step per line. Use ## Heading for sections.">
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={8}/>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            <Field label="Yield"><Input value={yieldF} onChange={(e) => setYieldF(e.target.value)} placeholder="4 servings"/></Field>
            <Field label="Prep"><Input value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="20 min"/></Field>
            <Field label="Cook"><Input value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="40 min"/></Field>
            <Field label="Total"><Input value={totalTime} onChange={(e) => setTotalTime(e.target.value)} placeholder="1 hr"/></Field>
          </div>

          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}/>
          </Field>
        </div>
      </div>

      {/* Fixed action bar — always visible at viewport bottom */}
      <div style={{
        position: "fixed", bottom: 0, left: 260, right: 0,
        zIndex: 10,
        padding: "14px 40px",
        background: "rgba(251, 246, 238, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--border-default)",
      }}>
        <div style={{
          maxWidth: "720px", margin: "0 auto",
          display: "flex", gap: "12px", alignItems: "center",
        }}>
          <Button variant="primary" type="submit">{submitLabel}</Button>
          <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}

function sectionsToText(sections) {
  return sections.map((s) => {
    const h = s.heading ? `## ${s.heading}\n` : "";
    return h + s.items.join("\n");
  }).join("\n\n");
}

window.RecipeForm = RecipeForm;
