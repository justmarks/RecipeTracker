# Web UI kit — MarksRecipeBook

A pixel-recreation of the desktop / tablet web experience of MarksRecipeBook. Built on top of the design system in the root (`../../colors_and_type.css`).

## What's here

- `index.html` — interactive demo. Click around to navigate between sign-in → recipe list → recipe detail → new recipe → import → chapters.
- `App.jsx` — top-level router-like state machine (no real react-router, just `useState` for view).
- `Sidebar.jsx` — left chapter navigation. Lists the user's chapters in order; highlights the active chapter; "+ New" and "Import" buttons pinned at the top.
- `RecipeListView.jsx` — Home page. Search field, recipe rows grouped by chapter.
- `RecipeDetail.jsx` — single-recipe view. Action bar (Favorite / Edit / Share / PDF / Delete, responsive icon-only under 640px), eyebrow / title / source / rating + last-made / times grid / ingredients / instructions / notes.
- `RecipeForm.jsx` — shared form for new + edit + import preview. Sticky action bar.
- `ImportView.jsx` — three import methods as equal cards: URL (AI), photo (drag-drop), markdown.
- `ChaptersView.jsx` — chapter management: drag-handle + up/down reorder, click-name-to-rename, icon delete with confirm dialog, inline add-row.
- `Dialogs.jsx` — `<ShareDialog>` (email + access list) and `<ConfirmDialog>` (delete), both as centered modal overlays.
- `SignInView.jsx` — Google + Microsoft sign-in.
- `primitives.jsx` — `<Button>` (with `iconFilled` for stateful icons), `<Input>`, `<Field>`, `<Tag>`, `<Icon>` (with `filled`), `<Eyebrow>`, `<MetaRow>`, `<Toast>`, `<PhotoFrame>`, `<StarRating>`.
- `data.js` — mock recipes + chapters (with `photo`, `rating`, `lastMadeDate`).

## Notes

- Routes in the real codebase are React Router routes: `/`, `/recipes/:id`, `/recipes/new`, `/recipes/:id/edit`, `/import`, `/chapters`. This kit simulates them via local state.
- The recipe data shape matches `shared/src/recipe.ts` exactly (sectioned ingredients/instructions, source as discriminated union, etc.) so the components can be lifted into the real app with minimal rewrap.
- All icons are inline SVG (Lucide-style) — `primitives.jsx → <Icon name="..."/>`. No CDN dependency.
