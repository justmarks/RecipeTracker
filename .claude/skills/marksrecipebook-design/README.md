# Marks Family Recipe Book — Design System

A warm, editorial, family-cookbook-flavored design system for **MarksRecipeBook**, a personal recipe library PWA.

> **Source codebase:** [github.com/justmarks/RecipeTracker](https://github.com/justmarks/RecipeTracker) — explore the README and CLAUDE.md there for technical architecture (Firebase + Vite + React + PWA manifest). Designs in this system should be built against the data model and routes defined in that repo.

---

## Product context

MarksRecipeBook is a **personal recipe library** for the Marks family. One person owns and edits; family members are granted shared or auto-shared access. It ships as a single PWA — installable on desktop, Android, and iOS Safari — with no native apps.

**Two surfaces** the design system covers:

1. **Web app (`ui_kits/web/`)** — the wide, three-column-ish desktop / tablet layout: sidebar with chapters, list of recipes, recipe detail. Used at home on a laptop while planning meals.
2. **Mobile PWA (`ui_kits/mobile/`)** — the installed-to-homescreen experience on Android / iOS. Single column, touch-first, big numbers for measurements you can read across the kitchen, plus the share-target import flow.

**The product's job:**
- Capture (form, markdown import, AI URL import, share-target on Android)
- Organize (chapters as a user-ordered table of contents, free-form tags)
- Find (token search by title + ingredients)
- Cook (open the recipe and read it on your phone while your hands are wet)
- Share (per-recipe and blanket auto-share with a family member's email)

**Audience:** Marks family members. Casual, friendly, not corporate. Multi-generational — needs to work for kids picking up an old phone AND for adults reading dense ingredient lists with floury fingers.

---

## Index — what's in this folder

| Path | What's there |
|---|---|
| `README.md` | This file. Read first. |
| `SKILL.md` | Agent-Skill front matter so you can drop this folder into Claude Code / Claude Desktop. |
| `colors_and_type.css` | All design tokens as CSS custom properties (colors, type, spacing, shadows, motion). Import this in any HTML you build. |
| `fonts/` | Local font files. Newsreader upright + italic variable fonts. Manrope and JetBrains Mono load from Google Fonts CDN. |
| `assets/` | Logo, monogram, wordmark, sprig divider, app icon source. SVGs — copy out what you need. |
| `preview/` | 19 small HTML cards that render in the Design System tab — brand lockup, color palettes, type specimens, spacing, components. Reference these to see tokens in use. |
| `ui_kits/web/` | Pixel-recreation of the web app: 9 React components, an interactive `index.html`, and a kit README. Routes-as-state-machine, no router. |
| `ui_kits/mobile/` | Pixel-recreation of the installed-PWA mobile experience. 5 key screens shown side-by-side on a design canvas inside iOS 26 device frames. |

**Quick map of the cards in `preview/`** (these populate the Design System tab):

| Group | Cards |
|---|---|
| Brand | lockup, monogram on different surfaces |
| Colors | paper + ink, tomato + olive, saffron + plum, semantic |
| Type | display (Newsreader), body (Manrope), mono (JetBrains), applied to a recipe |
| Spacing | scale, radii, shadows + focus |
| Components | buttons, form inputs, tags + chips, recipe card, list row, banners + toast, web kit, mobile kit |

---

## CONTENT FUNDAMENTALS

The brand voice was extracted from the README and CLAUDE.md in the source repo — terse, warm, technically literate, never marketing-fluffy.

### Tone
- **Plainspoken and warm**, never corporate. Sentences are short. Headlines are sentence case, not Title Case.
- **First person friendly.** "Your recipes." "You can rename a chapter." Never "users" or "the user" in copy.
- **Honest about constraints.** The source README says things like "*Not supported on iOS* (Safari/WebKit limitation); on iOS, copy the URL and paste it into the import screen." Keep that frankness in error states and empty states — explain *why* a limit exists, in one short sentence.
- **No exclamation marks.** No "Welcome!" No "🎉". This is a quiet cookbook, not an app trying to win you over.
- **Verbs over nouns** for actions. "Save recipe" > "Recipe save". "Add chapter" > "Chapter creation".

### Casing
- Sentence case for **all** UI: headings, buttons, menu items. ("New recipe", not "New Recipe".)
- Lowercase for tags and chapter slugs (`vegetarian`, `gluten-free`, `entree`) — display uses CSS `text-transform: capitalize`. This is enforced in the source data model.
- ALL CAPS only for eyebrow labels at `12px` with `0.12em` tracking ("INGREDIENTS", "PREP", "COOK").

### Punctuation
- Em dashes — like this — for parenthetical asides. Always with spaces around them.
- Curly quotes (`"smart quotes"`) and apostrophes (`'`) in display copy. Real cookbooks use them.
- Use `·` (middle dot) as a separator in metadata rows: `Entrée · vegetarian · 45 min`.

### Numbers and measures
- **Never abbreviate measures in ingredient lists.** "1 cup flour" not "1 c. flour". Cookbooks earn trust through clarity.
- **Use ranges with en-dashes**: `8–10 min`, not `8-10 min`.
- **Mono font for times and yields** so columns align: `45 min`, `4 servings`.

### Voice examples (real, lifted from / extrapolated from the codebase)

| Where | Copy |
|---|---|
| Empty state | "No recipes yet. Create one to get started." |
| Search no-results | "No recipes match "ginger"." |
| Import help | "We fetch the page and ask Claude to extract the recipe. Review the result before saving." |
| Import banner | "Review the parsed recipe below and save when you're happy with it." |
| Chapters intro | "Chapters group your recipes like sections in a cookbook. Rename or reorder freely — recipes in renamed chapters move with them." |
| iOS share limitation | "iOS doesn't support sharing to apps. Copy the URL and paste it into the import screen." |
| Save button (idle / busy) | "Save recipe" / "Saving…" |
| Confirm delete | "Delete chapter \"sides\"?" |

### Emoji
- **Never used in product UI.** No emoji in buttons, labels, empty states, or recipe content.
- The only acceptable "icon-as-character" usage is the **·** separator and an occasional **★** for favourites (if we ever add favourites). Decorative typographic flourish — the olive sprig — is a real SVG, not an emoji.

---

## VISUAL FOUNDATIONS

### Colors
The palette is intentionally narrow — five families, each spanning ~3–5 steps. No purples, no neutral grays, no pure black.

- **Paper** (cream) — backgrounds. `#FDFAF4 → #D9CAAE`. The whole product sits on `--paper-100` (`#FBF6EE`), the color of an old cookbook page.
- **Ink** (warm dark) — text. `#2A1F18 → #E5DCCC`. Always warm-brown, never neutral. Body copy at `--ink-700`.
- **Tomato** — the one brand color. `#C8553D` (primary), `#B0432D` (hover), `#903525` (press). Used for primary buttons, the wordmark italic, links, focus rings, the cookbook spine in the logo.
- **Olive** — secondary, used sparingly: success states, the sprig flourish, secondary tags, chapter accents.
- **Saffron** — warm highlight for ratings / badges. Use *once* per screen, not as a system color.
- **Plum** — quiet accent for the dessert chapter / occasional tag color.

Cards are **white on cream paper**, not cream on white — that single inversion is what makes the app feel printed rather than templated.

### Typography
- **Newsreader** — display. Editorial serif with a lovely italic. **Local files in `fonts/`** (upright + italic variable, opsz + wght axes).
- **Manrope** — UI sans. Friendly geometric, slightly rounded. Body text, buttons, fields, navigation. **Local file in `fonts/`** (variable wght 200–800).
- **JetBrains Mono** — numbers only. Prep/cook times, yields, ingredient measures when alignment matters. **Local files in `fonts/`** (upright + italic variable).

> All three families are fully self-hosted. No CDN dependency.

Type scale is 1.2 ratio, 12 / 14 / 16 / 18 / 20 / 24 / 30 / 38 / 48 / 64. Recipe titles are 38px on the detail page, 24px in list cards. Body steps are 18px with `line-height: 1.7` — *deliberately loose* so a wet finger can find its place again.

### Backgrounds
- **No gradients in product UI.** The only gradient is a subtle paper texture on the splash icon.
- **No imagery overlays.** The product is text-first; if a user adds a photo to a recipe (future), it sits in a dedicated framed card, never bleeds behind copy.
- **Cream paper everywhere.** `--paper-100` on `<body>`. Sunken sections (search results when empty) use `--paper-200`. Elevated cards use white.

### Borders and dividers
- Hairlines at `1px` solid `--paper-300` or `--ink-100` for in-flow dividers (between chapter sections, between fields in a form).
- **Decorative dividers** between major content blocks: the `sprig-divider.svg` asset — two thin horizontal lines flanking a tiny olive sprig. Used to separate Ingredients from Instructions in print-style recipe rendering.
- Card borders are *optional*: cards usually sit on cream with a `--shadow-sm`, no border. Borders appear only on inputs (`--border-strong`) and on "secondary" buttons.

### Corners and radii
- Inputs and buttons: `8px` (`--radius-md`)
- Cards: `14px` (`--radius-lg`)
- Hero / modals: `20px` (`--radius-xl`)
- Tags and small chips: `4px` (`--radius-sm`) — *flat, not pill-shaped* in product UI. Pills are reserved for avatars and the chapter section counter.

### Shadows
Warm-tinted (rgba of `--ink-700`, not gray). Four levels: `xs`, `sm`, `md`, `lg`. Cards default to `sm`; popovers and modals use `md` / `lg`. There is **no inner shadow** anywhere — the system is paper-flat.

Focus rings: `0 0 0 3px rgba(200, 85, 61, 0.25)` — a soft tomato halo. Always visible, never removed for "design".

### Hover and press states
- **Buttons (primary)**: hover = `--tomato-600`, press = `--tomato-700`. No scale, no shadow change.
- **Buttons (secondary)**: hover = `bg-hover` (`--paper-200`), press = `--paper-300`.
- **Links**: hover darkens to `--fg-link-hover`, underline thickens slightly.
- **List rows** (recipe in chapter list): hover = `--paper-200` background, no shift.
- **Press feedback** on touch (mobile): `opacity: 0.7` for 60ms, then back. No scale transforms.

### Motion
Quiet and short. Three durations: `120ms`, `200ms`, `320ms`. One easing curve for almost everything: `cubic-bezier(0.22, 1, 0.36, 1)` (out-expo-ish).
- **Fades** for appearance — toasts, modals.
- **No bounces, no springs.** This is a cookbook, not a games app.
- **Page transitions**: none. Routes change instantly. (PWA wants to feel snappy.)
- The only "playful" motion is the **toast that slides up from the bottom** when a recipe is saved, with a 200ms slide + fade.

### Layout rules
- **Desktop / tablet**: max-width content column of `680px` (`--max-w-content`). Chapter sidebar pinned left at `260px` on screens ≥ 1024px. Below that, sidebar collapses into a drawer.
- **Mobile**: full-width content with `20px` side gutter. Bottom-fixed tab bar with three items: Recipes, Import, Settings.
- **Vertical rhythm**: 8px-based. Section spacing usually `--space-8` (32px). Form field spacing `--space-4` (16px).
- **Sticky elements**: the page header (with title + add button) is sticky on mobile, scrolls with the page on desktop.

### Transparency and blur
- **No backdrop-filter blur in UI.** The system stays paper-flat.
- One exception: the iOS PWA status-bar pass-through on cover screens uses `backdrop-filter: blur(8px)` to keep status icons readable when content scrolls under them.

### Imagery
Photos are the primary supporting medium. Every recipe can carry a hero photo plus optional step photos. The system treats them with a single **`--photo-frame`** treatment so they always feel like part of the book, never like ads.

**Photo-frame rules:**
- **Radius**: 14px on vertical cards (matches the card itself); 10px on list thumbnails; 0 (full-bleed) at the top of recipe detail pages on mobile.
- **Border**: 1px solid `--paper-300` on cards and thumbs. No border on full-bleed.
- **Shadow**: inherits the card shadow; no shadow on the bare frame.
- **Aspect ratio**: 4:3 in vertical card layouts, 1:1 in list-row thumbnails, 3:2 on the recipe-detail hero. Always `object-fit: cover`.
- **No filter, no overlay, no gradient.** Photos render warm and grainy if shot in a kitchen — accept that, do not "correct" the color. The cookbook page already provides the warmth.
- **Empty state**: `--paper-200` background with a centered camera glyph in `--ink-300` plus italic Newsreader caption "*No photo yet*". This is what makes the card honest about the missing image rather than feeling broken.

**Where photos appear:**
- **Recipe card** (`preview/components-recipe-card.html`) — 4:3 photo on top, content below. Used for "Recently added" / "Shared with me" sections, search results, and any low-density discovery view.
- **Recipe row with thumb** (`preview/components-recipe-row-thumb.html`) — 64px square thumbnail on the left, title + meta on the right. The primary list pattern once photos exist. Replaces the text-only row in the home page.
- **Recipe-detail hero** — full-bleed 3:2 at the top of the detail page, edges flush with the page on mobile, rounded inside the content column on desktop.
- **Step photos** (optional, future) — inline with their step, 4:3, between the step number and the next step.

If a recipe has no photo, the row still renders cleanly with the camera-glyph placeholder. **Never block save flow on photo presence** — they're additive.

---

## ICONOGRAPHY

The source codebase **has no icons** today — it uses Unicode glyphs (`▲`, `▼`, `✕`, `←`, `+`) inline as text. The design system formalizes this with a small **Lucide icon set** loaded from CDN, plus the codebase's existing text-glyph approach for ASCII-grade affordances.

### Approach
1. **Primary icon library: Lucide** (https://lucide.dev), loaded from CDN as inline SVGs.
   - Stroke-based, 1.5px stroke at 20px display size.
   - Use the **outline** variants only — never filled. Matches the editorial / book vibe.
   - Always color icons with `currentColor` so they inherit the surrounding text color.
2. **Sizes**: 16, 20, 24. Default in UI is 20px next to text, 24px for tab bar and section headers.
3. **Recipe content uses no icons.** Ingredient lists, instructions, notes — pure typography. Icons are nav and chrome only.
4. **No emoji ever** — see Content Fundamentals.
5. **Unicode-as-icon is still allowed** for these specific cases, lifted from the existing codebase:
   - `▲ ▼` for reorder controls in the chapter list (kept for accessibility — they're screen-reader-friendly text)
   - `←` for back link
   - `·` (middle dot) as metadata separator
   - `✕` for clear-search button

### Lucide icons used in the kit
Tag the icons we lean on so designers don't reinvent: `book-open`, `plus`, `search`, `share-2`, `link`, `upload`, `file-text`, `chevron-right`, `chevron-left`, `chevron-up`, `chevron-down`, `pencil`, `trash-2`, `settings`, `user`, `log-out`, `check`, `x`, `clock`, `users` (auto-share), `bookmark`.

### Logo and brand assets
Real assets, not redrawn:
- `assets/app-icon.svg` — the 512×512 app icon (cookbook with M monogram + olive sprig). Source for the PWA `icons/` PNGs.
- `assets/monogram.svg` — circular M monogram on tomato. Use in nav, favicon, avatar placeholder.
- `assets/wordmark.svg` — "Marks Family / *Recipe Book*" lockup with sprig flourish. Use on cover screens, install prompts, the about page.
- `assets/sprig-divider.svg` — section divider. Use sparingly between major content blocks in print-style recipe rendering.

---

## How to use this design system

In any HTML file you build for this product:

```html
<link rel="stylesheet" href="../colors_and_type.css">
<!-- Lucide icons -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>document.addEventListener("DOMContentLoaded", () => lucide.createIcons());</script>
```

Then reference tokens directly: `background: var(--paper-100); color: var(--ink-900); font-family: var(--font-display);`. Avoid hard-coded hex values outside of `colors_and_type.css`.

---

## Caveats and known gaps

- The source codebase ships **zero design** — Tailwind defaults with slate / blue placeholders. This system is **net-new** and the user will want to iterate. Treat colors and the logo direction as v1.
- Newsreader, Manrope, JetBrains Mono are CDN-only — flag if you need them self-hosted.
- The user wants both web and mobile PWA, so all components should be tested at both 1024px and 390px widths.
