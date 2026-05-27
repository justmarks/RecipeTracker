---
name: marksrecipebook-design
description: Use this skill to generate well-branded interfaces and assets for the Marks Family Recipe Book, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

This is the design system for **MarksRecipeBook**, a personal recipe library PWA (Vite + React + Firebase). The source codebase lives at https://github.com/justmarks/RecipeTracker — read its README and CLAUDE.md if you need technical context (data model, security rules, PWA manifest).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out of `assets/` and create static HTML files for the user to view. Import the design tokens via `colors_and_type.css`. The bundled local fonts live in `fonts/` — keep the @font-face rules from `colors_and_type.css` intact when copying.

If working on production code (the real React codebase), copy assets and read the rules here to become an expert in designing with this brand. The components in `ui_kits/web/*.jsx` are cosmetic recreations — match their visual style, but lift their primitives (Button, Field, Tag, Eyebrow, MetaRow, SprigDivider) into the real Tailwind-based codebase rather than copying the code verbatim.

**Key principles to internalize:**
- Cream paper background (`--bg-page` = `#FBF6EE`), not white. Cards are white on cream.
- Tomato (`#C8553D`) is the only brand color. No purples, no slate, no neutral gray.
- Newsreader serif for display + recipe titles + italic accents. Manrope sans for UI. JetBrains Mono for times/yields/measures only.
- Sentence case everywhere. No emoji. Pluck the tone from the source codebase: terse, warm, honest about constraints.
- 44px minimum hit targets; 18px body for instruction steps with `line-height: 1.7` so a wet finger can find its place.
- Olive sprig divider between major content blocks in recipe layouts — it's a real SVG in `assets/`, not a decorative emoji.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (target audience, surface — web vs mobile PWA vs slide, fidelity, variants), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
