# CLAUDE.md

Guidance for Claude when working in this repo.

## Architecture in one paragraph

RecipeTracker is a **PWA** — a Vite + React + TypeScript SPA hosted on Firebase Hosting. All data lives in a single Cloud Firestore collection (`recipes/{id}`) protected by security rules that scope reads/writes to the owning user (plus users in `sharedWith`, plus users granted blanket access via the `autoShares` collection). The Claude API is **only** ever called from `functions/src/importFromUrl.ts` — never from the client, because the API key must not be shipped. Shared TypeScript types and Zod schemas live in `shared/` and are imported by both `web/` and `functions/`, so the client, server, and AI tool-use schema all agree on the shape of a `Recipe`. There is **no native Android or iOS app** — installability comes from the PWA manifest.

## PWA manifest

Declared in `web/vite.config.ts` via `vite-plugin-pwa`'s `manifest` option. The generated file is served as `/manifest.webmanifest`.

```ts
{
  name: "RecipeTracker",
  short_name: "Recipes",
  description: "A personal recipe library with AI-assisted import",
  lang: "en",
  dir: "ltr",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  display_override: ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
  orientation: "portrait-primary",
  theme_color: "#...",      // set when design system lands
  background_color: "#...",
  categories: ["food", "lifestyle"],
  launch_handler: { client_mode: "navigate-existing" },
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
    { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  screenshots: [
    { src: "/screenshots/wide-1.png",   sizes: "1280x720", type: "image/png", form_factor: "wide" },
    { src: "/screenshots/narrow-1.png", sizes: "750x1334", type: "image/png", form_factor: "narrow" },
  ],
  shortcuts: [
    { name: "New recipe",       url: "/recipes/new",     icons: [{ src: "/icons/new-96.png", sizes: "96x96" }] },
    { name: "Import from URL",  url: "/import?via=shortcut" },
  ],
  share_target: {
    action: "/import",
    method: "GET",
    params: { title: "title", text: "text", url: "url" }
  },
  protocol_handlers: [
    { protocol: "web+recipe", url: "/recipes/%s" }
  ],
  file_handlers: [
    { action: "/import", accept: { "text/markdown": [".md", ".markdown"] } }
  ],
  prefer_related_applications: false
}
```

Apple-specific `<link>` tags (added to `web/index.html`, not the manifest):
```html
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Recipes">
```

**Share-target uses GET, not POST.** This keeps `/import` a normal SPA route — React Router reads the `title`, `text`, `url` query params and prefills the importer. POST + service-worker routing was considered and rejected as unnecessary complexity for URL-only sharing.

**iOS reality**: `share_target` is ignored by iOS Safari. There's no workaround — copy-paste is the iOS fallback. Don't waste time trying to make share-to-import work on iOS without a native app.

## Service worker (Workbox via vite-plugin-pwa)

- Strategy: `registerType: "autoUpdate"`, `workbox.cleanupOutdatedCaches: true`
- Precache: app shell (`index.html`, JS/CSS bundles, icons)
- Runtime caching:
  - Google Fonts → `CacheFirst` with 1y expiration
  - Firebase Auth / Firestore endpoints → **bypass** (no service-worker caching of API calls; Firestore has its own offline cache)
- Update prompt: show a toast when `useRegisterSW({ onNeedRefresh })` fires; user clicks "Reload" to apply

## Firestore data model

Single collection `recipes/{recipeId}`:

```ts
type Section<T> = { heading: string | null; items: T[] };

type RecipeSource =
  | { type: "url"; url: string }
  | { type: "book"; title: string; author?: string; page?: string };

type Recipe = {
  ownerId: string;                    // Firebase Auth uid
  title: string;
  source?: RecipeSource;              // URL OR book reference
  ingredients: Section<string>[];     // [{ heading: "Cake" | null, items: ["1 cup flour", ...] }]
  instructions: Section<string>[];    // same shape; items are ordered steps
  notes?: string;
  yield?: string;
  prepTime?: string;                  // free text — "20 min", "1 hr 15 min"
  cookTime?: string;
  totalTime?: string;
  category: "appetizer" | "side" | "sauce" | "soup" | "salad" | "entree";
  tags: string[];                     // lowercase, e.g. ["vegetarian", "gluten-free"]
  sharedWith: string[];               // uids granted EXPLICIT per-recipe access
  searchTokens: string[];             // lowercase tokens from title + ingredients (for array-contains queries)
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

**Why `searchTokens`:** Firestore has no native full-text search. Normalize title + ingredient text into a deduped lowercase token array and query with `array-contains-any`. If this hits limits later, swap in Typesense or Algolia — don't pre-optimize.

**Auto-share** lives in its own top-level collection so it doesn't have to mutate every recipe doc:

```ts
// autoShares/{ownerId}_{granteeUid}    ← deterministic doc id makes existence checks O(1)
type AutoShare = {
  ownerId: string;
  granteeUid: string;
  granteeEmail: string;
  createdAt: Timestamp;
};
```

Never backfill `sharedWith` from auto-shares. Keep `sharedWith` for explicit per-recipe shares only. Revoking an auto-share is a single delete; explicit shares survive.

## Security rules (intent)

For `recipes/{recipeId}`:
- **Read**: `request.auth.uid == resource.data.ownerId`
  `|| request.auth.uid in resource.data.sharedWith`
  `|| exists(/databases/$(database)/documents/autoShares/$(resource.data.ownerId + '_' + request.auth.uid))`
- **Write**: `request.auth.uid == resource.data.ownerId` only

For `autoShares/{shareId}`:
- **Read/Write**: only when `shareId` starts with `{request.auth.uid}_`

When adding fields to `Recipe`, update the validation block in `firestore.rules` too.

**Listing recipes shared via auto-share**: Firestore queries can't `OR` across collections, so the client runs two queries and merges client-side:
1. `where("ownerId", "==", uid)` + `where("sharedWith", "array-contains", uid)` for owned + explicitly shared
2. For each auto-share doc where `granteeUid == uid`, query `recipes` where `ownerId == autoShare.ownerId`

Merge and dedupe by recipe id. This logic lives in `web/src/lib/queryRecipes.ts`.

## Auth conventions

- Use **`signInWithRedirect`**, not `signInWithPopup`. Redirect works on iOS Safari (popup blockers + storage partitioning break popups in PWA mode).
- Restore the redirect result on app boot: call `getRedirectResult(auth)` in `web/src/lib/useAuth.ts`.
- Microsoft provider scopes: `["openid", "email", "profile"]`. Add custom params (`tenant: "common"`) for personal + work accounts.

## Where things live

| Need to touch | Path |
|---|---|
| A new screen / route | `web/src/routes/<route>.tsx` |
| Recipe form / parser UI | `web/src/components/recipe/` |
| Firebase init | `web/src/lib/firebase.ts` |
| Auth provider + hook | `web/src/lib/useAuth.tsx` (exports `AuthProvider` + `useAuth`) |
| Recipe list query (owned + shared + auto-shared) | `web/src/lib/queryRecipes.ts` |
| Markdown import | `web/src/lib/importMarkdown.ts` (client-side, no network) |
| Share-target landing | `web/src/routes/import.tsx` — reads `?url=` / `?text=` / `?title=` from URL, calls the URL importer or markdown importer |
| Recipe types + Zod schemas | `shared/src/recipe.ts` |
| `searchTokens` generation | `shared/src/searchTokens.ts` — must be called from every create/update path |
| URL import (Claude) | `functions/src/importFromUrl.ts` |
| Share single recipe with user | `functions/src/shareRecipe.ts` (resolves email → uid, appends to `sharedWith`) |
| Auto-share grant / revoke | `functions/src/autoShare.ts` — writes/deletes `autoShares/{ownerId}_{granteeUid}` |
| Auto-share management UI | `web/src/routes/settings/sharing.tsx` |
| PWA manifest + service worker config | `web/vite.config.ts` (vite-plugin-pwa `manifest` and `workbox` options) |
| Apple `<link>` / `<meta>` tags | `web/index.html` |

## Claude API conventions

- **Default model**: `claude-haiku-4-5`. Escalate to `claude-sonnet-4-6` only when Haiku fails structured-output validation.
- Use **tool-use with a strict JSON schema** matching the `Recipe` Zod schema in `shared/`. Never parse free-form text from the model.
- Use **prompt caching** on the system prompt — extraction instructions are stable, only the page HTML changes.
- API key is a Cloud Functions secret named `ANTHROPIC_API_KEY`, accessed via `defineSecret`. Never put it in `.env` files committed to git.
- Follow the `claude-api` skill for SDK patterns (cache control, tool use, model selection).

## Commands

```
pnpm install                              # first-time setup
pnpm --filter web dev                     # Vite dev server → http://localhost:5173
pnpm --filter web build                   # production build (runs vite-plugin-pwa)
pnpm --filter web preview                 # serve the production build locally (use this to test the installed PWA / service worker)
pnpm --filter functions build             # tsc for functions
pnpm --filter functions emulate           # local functions emulator
firebase emulators:start                  # full emulator suite (auth + firestore + functions + hosting)
pnpm test                                 # workspace-wide tests
firebase deploy --only functions          # ship functions
firebase deploy --only hosting            # ship web
```

## Things to avoid

- **Don't** call `@anthropic-ai/sdk` from `web/` — the API key would leak. Always proxy through `functions/src/importFromUrl.ts`.
- **Don't** denormalize recipes across collections. A single `recipes/{id}` doc with a `sharedWith` array is enough for MVP. Reach for subcollections only when a recipe exceeds 1MB.
- **Don't** add a dedicated search service (Algolia, Typesense) until Firestore `array-contains-any` on `searchTokens` actually fails the user. Premature.
- **Don't** introduce a separate backend (Express, Hono, etc.). Cloud Functions *is* the backend.
- **Don't** ship recipe writes that bypass `searchTokens` regeneration — keep token generation in a single helper in `shared/` and call it from every create/update path.
- **Don't** backfill `sharedWith` from auto-shares. Auto-share access lives entirely in the `autoShares` collection and is enforced via `exists()` in security rules.
- **Don't** treat `source` as a string. It's a discriminated union (`{type: "url", ...} | {type: "book", ...}`). The recipe form, the Claude extraction tool schema, and any display code must all branch on `source.type`.
- **Don't** try to make share-to-import work on iOS. WebKit doesn't support Web Share Target API and no browser on iOS can work around it. Document copy-paste as the iOS path.
- **Don't** cache Firebase Auth or Firestore endpoints in the service worker. Firestore manages its own offline cache; double-caching causes stale-data bugs.
- **Don't** use `signInWithPopup`. Use `signInWithRedirect` + `getRedirectResult` — popups are unreliable in installed-PWA contexts on iOS.
