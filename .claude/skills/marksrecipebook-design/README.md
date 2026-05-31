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
| `ui_kits/web/` | Pixel-recreation of the web app: React components + interactive `index.html` + kit README. Routes-as-state-machine, no router. Covers favorites, share + delete dialogs, three import methods, the full recipe action bar. |
| `ui_kits/mobile/` | Pixel-recreation of the installed-PWA mobile experience. 5 key screens shown side-by-side on a design canvas inside iOS 26 device frames. |

**Quick map of the cards in `preview/`** (these populate the Design System tab):

| Group | Cards |
|---|---|
| Brand | lockup, monogram on different surfaces |
| Colors | paper + ink, tomato + olive, saffron + plum, semantic |
| Type | display (Newsreader), body (Manrope), mono (JetBrains), applied to a recipe |
| Spacing | scale, radii, shadows + focus |
| Components | buttons, form inputs, tags + chips, recipe card, list row, rating + source, favorite + actions, favorites (heart), star rating, photo upload, source toggle, share dialog, sharing screen, PWA prompts, banners + toast, web kit, mobile kit |

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
- **Chapter names preserve the case the user types, in storage.** Production stores "BBQ" or "Pasta Night" exactly as entered (don't `.toLowerCase()` on save); uniqueness is enforced case-insensitively (so "BBQ" and "bbq" can't both exist). Default chapters are seeded lowercase ("appetizer", "entree").
- **For display, `text-transform: capitalize` is correct and used throughout.** It only uppercases the first letter of each word without touching the rest, so lowercase defaults render as "Appetizer" while a user's "BBQ" stays "BBQ". (Earlier this system *also* forced `.toLowerCase()` on save, which would have destroyed "BBQ" → "bbq" → "Bbq". That's been corrected — preserve case on save, capitalize only on display.)
- Tags are still lowercase by convention (`vegetarian`, `gluten-free`).
- The **`uncategorized`** chapter is a reserved fallback: it can't be deleted, and recipes whose chapter is deleted are rehomed into it automatically.
- ALL CAPS only for eyebrow labels at `12px` with `0.12em` tracking ("INGREDIENTS", "PREP", "COOK").

> **Capitalize CSS, carefully.** Chapter names use `text-transform: capitalize` for display so lowercased data ("main course") renders as "Main Course" while user-typed "BBQ" stays "BBQ". **Do not apply that same rule to system-generated text** — the page-title fallback "All recipes" must stay sentence case, not become "All Recipes". Scope `capitalize` to the chapter-name data only.

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

> **Baseline vs. inter-scale.** The numbers above are the baseline — use them by default. The kit's primitives also reach for inter-scale values (11, 13, 15, 17, 22, 26, 32, 34, 44) where the visual rhythm needs finesse: 22px for the italic "Recently added" / section h2s, 17px for compact card titles, 34px for the mobile recipe-detail hero, 44px for the desktop hero. These are acceptable for typographic finesse — don't invent values outside this combined set.

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

## PRODUCT PATTERNS

Interaction patterns that have appeared in the live app since v1. Each has a preview card and is wired into the web UI kit.

### Favorites
- Per-user, not per-recipe (two people can independently favorite the same shared recipe). Stored in a separate `favorites/{uid}_{recipeId}` collection.
- UI is a **heart** — outline (ink-300) when off, **filled tomato-600** when on (tomato-500 on hover). Available to *everyone who can see a recipe* (owners and shared viewers), unlike Edit/Share/Delete which are owner-only.
- **Where it appears:** every list row (right of the meta line), each card's photo corner (on a frosted-glass pill), and the detail action bar as a labelled button ("Favorite" / "Favorited").
- **Navigation:** a "Favorites" entry in the sidebar between "All recipes" and the chapters, with a heart icon and a live count. A standalone favorites view (`/?favorites=1`) titled "Favorites", always sorted alphabetically.
- **On Home:** a collapsible "Favorites" section sits between "Recently added" and the chapter sections.
- **Empty state** (filtered to favorites, none yet): "No favorites yet. Tap the heart on any recipe to keep it within easy reach here."

### "Other" pseudo-chapter (orphan recipes)
- Recipes whose `category` isn't a current chapter are **orphans**. They surface under a system "Other" grouping — never lost.
- Sidebar: an "Other" entry (italic, like "All recipes") *after* the chapters, shown only when orphan count > 0, active at `/?view=other`.
- Home: a collapsible "Other" section after the chapter sections. Same row styling as a chapter.
- Distinct from **"Uncategorized"**: that's a real, system-managed chapter auto-created (and appended to the user's chapter list) when a chapter is deleted while it still holds recipes — those recipes are reassigned to it. "Other" is a *view-time* grouping of orphans; "Uncategorized" is a *stored* chapter.

### Collapsible Home sections
- Every section header on Home (chapter h2s plus "Recently added" / "Favorites" / "Other") doubles as a collapse toggle.
- A disclosure chevron rotates 90° between states (`chevron-right` → pointing down when open).
- **During search, all sections force-expand** regardless of stored collapsed state.
- Collapsed state persists across navigation for the session (the kit uses `sessionStorage`; production may use the same or per-user prefs).

### Recipe action bar
The detail page's action row, in order: **Favorite · Edit · Share · PDF · Delete**.
- Favorite + PDF: available to all viewers. Edit / Share / Delete: owner-only.
- Buttons are `secondary` size `sm` with a leading icon; **labels collapse to icon-only below 640px** (`hidden sm:inline` in production). Delete is the `danger` variant.
- PDF triggers the browser's native print → "Save as PDF" (see the print stylesheet in `index.css`); the kit stubs it with a toast.

### Source — URL or book reference
- The form has a **URL / Book segmented toggle** above the source input (`Segmented` primitive).
- **URL mode:** a single URL field. Detail renders the small "View source · domain" button.
- **Book mode:** three inline inputs — Book title (required), Author (optional), Page (optional). Detail renders "From *Joy of Cooking* by Rombauer, p. 142" (book title in Newsreader italic).

### Photo — URL or upload
- The form's Photo field pairs a URL input with a **"Choose file"** upload button.
- Uploaded files go to Firebase Storage; the returned URL is then stored (the kit fakes this with an object URL). `photoUrl` (a pasted link) and an uploaded file resolve to the same stored field.
- Once a photo is set, a **1:1 thumbnail** (radius-sm) shows below the field with a "Remove photo" action.
- Missing-photo placeholder everywhere: italic Newsreader "*No photo yet*" on `--paper-200` with a camera glyph (`PhotoFrame` empty state).

### Rating + last made
- **Rating:** five saffron stars. Form is an input (`StarRatingInput`) — click to set 1–5, click the current value to clear. Detail and list rows show the read-only `StarRating`.
- **Last made:** an optional native date picker in the form (`YYYY-MM-DD`). Detail pairs it with a clock icon after the rating ("★★★★ · ⏱ Last made May 27, 2026"); list rows show a short "made Apr 12".

### Sharing
- **Per-recipe share** — the `ShareDialog`: email input, resolves to a family member, lists who has access with Remove buttons. Built on the native `<dialog>` element (focus trap, Esc, backdrop click).
- **Blanket auto-share** — Settings → Sharing (sidebar "Sharing" entry → `SharingView`). Two directions: **outgoing** ("People who can see all your recipes", each with a danger Remove) and **incoming** ("People who shared their cookbook with you", read-only). Top of the screen is a "Share your cookbook" card with email + Share.
- **Shared pill:** any recipe row visible via a share (not owned) shows an olive pill — `olive-100` bg, `olive-700` fg, a `share-2` icon at 10px — in its meta line.

### Import — three methods
Presented as three equal cards (no primary/fallback hierarchy):
1. **From URL** — fetch + AI extract (`sparkles` icon).
2. **From a photo** — snap a cookbook page or handwritten card; drag-drop zone + "Choose photo" (`image` / `upload` icons).
3. **From markdown** — paste with `## Headings` for sections (`file-text` icon).

**Loading states:** when import auto-fires from an OS share-target (URL or photo), show a **full-page overlay** — spinning `sparkles`, headline "Importing recipe…" / "Reading photo…", short hint. During *interactive* import (the user clicked Fetch), an inline button-busy state is enough — no overlay.

**Anti-fabrication banner** above the review form: `saffron-100` with `saffron-700` text and a `sparkles` icon — "Claude returned the recipe below. Tweak anything that looks off, then save." All methods land on the same `RecipeForm` review screen.

### PWA prompts
Three bottom-center banners (max-width 92vw, rounded-lg, soft shadow, slide-up + fade), never more than one relevant at a time:
- **Update available** — tomato (`brand` tone), sparkles icon, "A new version of Recipe Book is ready." + Reload + dismiss.
- **Offline ready** — olive tone, check icon, auto-hides after 5s.
- **Install** — ink tone (`ink-900` bg), bookmark icon, "Install Recipe Book to your home screen." + Install; dismissal persists in `localStorage` so it doesn't reappear on every service-worker update.

### Mobile shell — current vs. future
The production app today reuses the **desktop sidebar as a drawer** on mobile (the sidebar slides in). The mobile UI kit in this system instead shows a **bottom tab bar** (Recipes / Import / You), which feels more native but would require a routing/shell refactor in production.
- **Document both:** *current implementation is the drawer; the tab-bar is the intended future direction.* The mobile kit is a forward-looking target, not a description of today's shipped shell — don't treat the tab bar as production-accurate until that refactor lands.

### PDF / print
The app has no separate "export" UI — the PDF button calls `window.print()`, and a print stylesheet in `index.css` handles paper sizing, color preservation (so tomato dots and the saffron notes card don't print gray), page-break hints, and hides all chrome via `print:hidden`. Any new full-page chrome must add `print:hidden`.

---

The production codebase ships its **own inlined Lucide-style icon set** — `web/src/components/ui/Icon.tsx`, a `<Icon name="…" size filled>` component with ~30 hand-inlined stroke paths (no Lucide runtime dependency). The design system mirrors this exact approach: inline SVG, stroke-based, `currentColor`, outline by default with an optional `filled` flag for stateful icons.

### Approach
1. **Inline Lucide-style icons** — copied as SVG paths into the kit's `Icon` component, matching `Icon.tsx` in the codebase. No CDN, no runtime.
   - Stroke-based, 1.5px stroke at 20px display size.
   - **Outline by default.** One exception: the **favorite heart** uses `filled` (fill = `currentColor`, tomato-600) when active. The `filled` prop exists precisely for stateful icons like this.
   - Always color icons with `currentColor` so they inherit the surrounding text color.
2. **Sizes**: 14, 16, 20, 24. Default in UI is 20px next to text, 16px in `size="sm"` buttons, 24px for tab bar and section headers.
3. **Recipe content uses no icons.** Ingredient lists, instructions, notes — pure typography. Icons are nav and chrome only.
4. **No emoji ever** — see Content Fundamentals.
5. **Unicode-as-icon is still allowed** for these specific cases:
   - `·` (middle dot) as metadata separator
   - `★` for the star rating (production renders ratings as `★`-repeat strings; the kit uses matched SVG stars — either is fine)

### Icons used in the kit
`book-open`, `plus`, `search`, `share-2`, `share`, `link`, `upload`, `file-text`, `image`, `chevron-right`, `chevron-left`, `chevron-up`, `chevron-down`, `arrow-left`, `pencil`, `trash`, `settings`, `user`, `users` (auto-share), `log-out`, `check`, `x`, `clock`, `heart` (favorite — needs `filled`), `download` (PDF), `mail` (share list), `bookmark` (install), `sparkles` (AI import), `grip-vertical` (drag reorder). The five added for the features above — `heart`, `download`, `mail`, `image`, `grip-vertical` — are all present in the production icon set and now inventoried in the kit's `ICON_PATHS`.

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
