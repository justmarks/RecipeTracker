# Web UI kit — MarksRecipeBook

A pixel-recreation of the desktop / tablet web experience of MarksRecipeBook. Built on top of the design system in the root (`../../colors_and_type.css`).

## What's here

- `index.html` — interactive demo. Click around to navigate between sign-in → recipe list → recipe detail → new recipe → import → chapters.
- `App.jsx` — top-level router-like state machine (no real react-router, just `useState` for view).
- `Sidebar.jsx` — left chapter navigation. Lists the user's chapters in order; highlights the active chapter; "+ New" and "Import" buttons pinned at the top.
- `RecipeListView.jsx` — Home page. Search field, recipe rows grouped by chapter.
- `RecipeDetail.jsx` — single-recipe view. Eyebrow / title / source / times grid / ingredients / instructions / notes.
- `RecipeForm.jsx` — shared form for new + edit + import preview.
- `ImportView.jsx` — URL-AI / markdown-paste import screen.
- `ChaptersView.jsx` — chapter management (reorder / rename / delete).
- `SignInView.jsx` — Google + Microsoft sign-in.
- `primitives.jsx` — `<Button>`, `<Input>`, `<Field>`, `<Tag>`, `<Icon>`, `<Eyebrow>`, `<Toast>`.
- `data.js` — mock recipes + chapters used by every view.

## Notes

- Routes in the real codebase are React Router routes: `/`, `/recipes/:id`, `/recipes/new`, `/recipes/:id/edit`, `/import`, `/chapters`. This kit simulates them via local state.
- The recipe data shape matches `shared/src/recipe.ts` exactly (sectioned ingredients/instructions, source as discriminated union, etc.) so the components can be lifted into the real app with minimal rewrap.
- All icons are inline SVG (Lucide-style) — `primitives.jsx → <Icon name="..."/>`. No CDN dependency.
