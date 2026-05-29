# MarksRecipeBook

A personal recipe library — installable as a PWA on desktop, Android, and iOS — with AI-assisted import.

## Features

**Capture**
- Sign in with Google or Microsoft (Firebase Auth)
- Create a recipe from scratch
- Import a recipe from a markdown file
- Import a recipe from a URL (AI-assisted via Claude)
- **Import a recipe from a photo** (AI-assisted via Claude vision) — snap a cookbook page, a magazine clipping, a recipe card, or handwriting; the photo is resized client-side to ~2048px before upload to keep things snappy
- **Share-to-app** from another app — Android Chrome's share sheet offers MarksRecipeBook as a destination for **URLs, plain text, and photos**. Photos share via POST + multipart and are handed off through a service-worker stash; URLs come through query params. *Not supported on iOS* (Safari/WebKit limitation); on iOS, copy the URL or use the photo upload affordance in the web UI.
- **File-handler** registration — `.md` files offer "Open with MarksRecipeBook" on desktop OSes that support it

**Organize**
- Sectioned ingredients (e.g. "Cake", "Frosting", "Assembly") as a bulleted list per section
- Sectioned instructions as numbered steps per section
- **Source** can be a URL **or** a book reference (title, author, page)
- Optional fields: Yield, Prep Time, Cook Time, Total Time
- Notes field for free-form annotations
- Categories (chapters) — fully user-managed: rename, reorder, add, delete. Default chapters seeded on first sign-in: Appetizer · Side · Sauce · Soup · Salad · Entrée · Dessert
- **Auto-Uncategorized on chapter delete** — deleting a chapter with recipes still in it atomically reassigns them to an "Uncategorized" chapter (auto-created if it doesn't exist yet) so recipes never get orphaned
- Tags: Vegetarian, Gluten Free, and any others you add

**Find & share**
- Search recipes by keyword or by ingredient
- View and edit existing recipes
- **Favorites** — heart any recipe (from the detail page or directly from the list); a "Favorites" section appears at the top of the list view and a "Favorites" entry sits at the top of the sidebar chapter nav. Favorites are per-user, so two people sharing a recipe can each favorite it independently
- **Export as PDF** — every recipe has a "PDF" action that opens the browser's native print → "Save as PDF" flow with a recipe-only print stylesheet (Newsreader typography preserved, app chrome stripped)
- Share a single recipe with another user (by email)
- **Auto-share**: grant a person blanket access to every recipe you own — applies to existing recipes and anything you add later, until you revoke it

**PWA niceties**
- Installable to home screen / desktop with a full app icon set (including maskable variants)
- Offline-capable app shell with Workbox-managed runtime caching (fonts, recipe photos)
- Home-screen shortcuts: "New recipe", "Import a recipe"
- `protocol_handlers` registration of `web+recipe:` for deep links from external apps
- `launch_handler: "navigate-existing"` so share-target activations open in the already-running window

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Vite + React + TypeScript** | Fast dev server, simple static build for Firebase Hosting |
| Routing | **React Router** | Standard SPA routing; query-param-driven `/import` route handles share-target |
| PWA tooling | **vite-plugin-pwa** (GenerateSW mode) | Generates manifest + Workbox service worker from `vite.config.ts`; share-target POST handled via a small `importScripts` add-on |
| Auth | **Firebase Auth** — Google + Microsoft OAuth via `signInWithRedirect` | Hosted OAuth, redirect flow avoids popup blockers on iOS |
| Database | **Cloud Firestore** | Realtime sync, per-user security rules, offline cache |
| Backend | **Firebase Cloud Functions** (TypeScript) | Hosts Claude API calls, URL fetching, share-link generation, photo cleanup triggers |
| AI | **Claude API** — `claude-haiku-4-5` default | URL → structured recipe via tool-use; photo → structured recipe via vision + tool-use; system prompts use prompt caching |
| Hosting | **Firebase Hosting** | Serves the SPA + PWA manifest + service worker |
| CI/CD | **GitHub Actions** | Pushes to `main` build and deploy hosting + functions + firestore rules + storage rules |
| Repo | **pnpm workspaces** (web + shared) + npm (functions) | One install, shared types between `web/` and `functions/`; functions uses npm to match Firebase tooling |

No native Android or iOS builds. No Expo, no React Native, no EAS, no Apple Developer Program. Everything ships through Firebase Hosting.

## Repo layout

```
recipe-tracker/
├── .github/workflows/
│   └── deploy.yml                  # CI/CD: push to main → full Firebase deploy
├── web/                            # Vite + React PWA
│   ├── public/
│   │   ├── icons/                  # 192/256/384/512 + maskable + apple-touch
│   │   ├── fonts/                  # Newsreader, Manrope, JetBrains Mono (variable)
│   │   └── share-target-handler.js # SW add-on: handles POST /import (photo share)
│   ├── src/
│   │   ├── routes/                 # React Router routes
│   │   ├── components/             # UI kit (Button, Icon, Tag, …) + features
│   │   ├── lib/
│   │   │   ├── firebase.ts
│   │   │   ├── useAuth.tsx
│   │   │   ├── queryRecipes.ts     # owned + shared + auto-shared fan-out
│   │   │   ├── categories.ts       # user chapters CRUD
│   │   │   ├── favorites.ts        # useFavorites + optimistic toggle
│   │   │   ├── importMarkdown.ts
│   │   │   ├── importImage.ts      # client-side resize + base64
│   │   │   └── shareTarget.ts      # reads photo stashed by SW
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts              # vite-plugin-pwa: manifest + Workbox config
├── functions/                      # Firebase Cloud Functions (TS, npm)
│   └── src/
│       ├── importFromUrl.ts        # Claude URL extractor
│       ├── importFromImage.ts      # Claude vision extractor
│       ├── shareRecipe.ts
│       ├── autoShare.ts
│       └── photoCleanup.ts         # Storage cleanup on recipe delete/update
├── shared/                         # Shared types + Zod schemas
│   └── src/recipe.ts               # Recipe, Favorite, chapter constants
├── firebase.json
├── firestore.rules                 # recipes / users / favorites / autoShares
├── firestore.indexes.json
├── storage.rules
├── pnpm-workspace.yaml             # workspace members: web, shared (NOT functions)
└── package.json                    # lint / typecheck / deploy scripts
```

## Data model

Single recipes collection plus a handful of small per-user collections:

| Collection | Doc id | Notes |
|---|---|---|
| `recipes/{id}` | auto | `ownerId`, `title`, `ingredients[]`, `instructions[]`, `category`, `tags[]`, `sharedWith[]`, `searchTokens[]`, … |
| `users/{uid}` | uid | `categories[]` (ordered chapter list) |
| `favorites/{uid}_{recipeId}` | deterministic | Per-user favorites; O(1) toggle via `setDoc`/`deleteDoc` |
| `autoShares/{ownerId}_{granteeUid}` | deterministic | Blanket recipe access; existence checked via `exists()` in security rules |

See [CLAUDE.md](CLAUDE.md) for the full schema and reasoning.

## Prerequisites

- Node 20+ and pnpm 9+
- Firebase CLI — `npm i -g firebase-tools`

That's it. No Android SDK, no Xcode, no Java.

## Setup

1. Clone the repo and run `pnpm install` from the root. (A root `postinstall` also runs `npm --prefix functions install`, so functions deps are primed too.)
2. Create a Firebase project. In the console, enable:
   - **Authentication** → Google provider and Microsoft provider
   - **Firestore Database** (production mode)
   - **Cloud Functions** (Blaze plan required for outbound network calls to the Claude API)
   - **Storage** (recipe photos)
   - **Hosting**
3. **Microsoft auth setup**: register an app in Azure AD, generate a client secret, and paste the client ID + secret into Firebase Auth's Microsoft provider config. Add `https://<your-firebase-domain>.firebaseapp.com/__/auth/handler` as a redirect URI in Azure.
4. Copy `web/.env.example` to `web/.env` and fill in the Firebase web config keys (all prefixed `VITE_FIREBASE_`).
5. Set the Anthropic API key as a Cloud Functions secret:
   ```
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
6. Deploy rules and indexes once:
   ```
   pnpm deploy:rules
   ```

## Running locally

| Target | Command |
|---|---|
| Web dev server | `pnpm dev` (or `pnpm --filter web dev`) → http://localhost:5173 |
| Functions emulator | `pnpm --filter functions emulate` |
| Both with Firebase emulator suite | `firebase emulators:start` |

Set `VITE_USE_EMULATOR=1` in `web/.env` to point the client at local Firebase emulators.

PWA install prompt only fires on HTTPS or `localhost`, and service workers are disabled in `vite dev` by default — to test the installed-PWA experience (share-target, photo import via share sheet, offline behavior), run `pnpm build && pnpm preview`.

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Production build of `web/` (includes vite-plugin-pwa SW generation) |
| `pnpm preview` | Serve the production build locally |
| `pnpm lint` | Lint across all packages (`web`, `shared` skip if no lint script; `functions` is linted via npm) |
| `pnpm lint:fix` | Same with `--fix` |
| `pnpm typecheck` | `tsc --noEmit` across packages |
| `pnpm deploy` | Full deploy: hosting + functions + firestore + storage |
| `pnpm deploy:hosting` | Hosting only |
| `pnpm deploy:functions` | Functions only |
| `pnpm deploy:rules` | Firestore rules + indexes + storage rules |

## CI/CD

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys to Firebase on every push to `main`. Required GitHub secrets:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_MARKSRECIPEBOOK` | JSON key for a GCP service account with `roles/firebase.admin`, `roles/firebasestorage.admin`, `roles/cloudfunctions.admin`, `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/artifactregistry.writer`, `roles/serviceusage.serviceUsageConsumer`, `roles/secretmanager.admin`. Notes: `firebasestorage.admin` is separate from `firebase.admin` (without it, storage rule deploys fail). `secretmanager.admin` is required because the functions use `defineSecret("ANTHROPIC_API_KEY")` and the deploy SA needs to read secret metadata and bind it to the function. |
| `VITE_FIREBASE_API_KEY` etc. | The same `VITE_FIREBASE_*` values that go in `web/.env` (intentionally public per the Firebase web SDK — could also be repository variables) |

Concurrency is gated so two pushes in quick succession don't race the deploy.

## Bulk import

See [scripts/README.md](scripts/README.md) for a Node script that imports
a whole folder tree of `.md` files at once (folder name → chapter).
Uses the Firebase Admin SDK; requires a service-account key.

## Roadmap

Tracked here so they don't get lost:

- **Grocery list generation** — multi-select recipes → consolidated list
- **Meal plan** — pick N recipes and produce a plan for the week
- **Unit conversion** — cups / tsp ↔ grams
- **Photo upload to recipe** (currently photo-URL only; Storage-backed upload for `photoUrl` pending — note that the photo *importer* described above is a different feature, it reads recipe text from a photo)

## Known issues

- **`marksrecipebook.web.app` sign-in fails; `.firebaseapp.com` works.**
  The `.web.app` domain isn't in Firebase Auth's authorized-domains list
  by default. Fix: Firebase Console → Authentication → Settings →
  Authorized domains → Add domain → `marksrecipebook.web.app`. (Pure
  Console fix, nothing to deploy.)
- **Dotdash Meredith sites refuse the URL importer.** AllRecipes,
  Serious Eats, Simply Recipes, Food & Wine, Eating Well, and Brides
  all share an anti-bot layer that fingerprints the request beyond
  headers (DataDome / similar — returns HTTP 402 to flagged IPs).
  The function sends Chrome Client Hints + browser headers, which
  gets past Kitchn and most Cloudflare sites, but Dotdash properties
  appear permanently blocked from Cloud Functions IP ranges. Fall
  back to copying the recipe text and using the markdown importer.
  Same applies to NYT Cooking (paywall) and any site requiring login.
  When this happens on a page you control, the photo importer is a
  good fallback — screenshot the rendered page and share it in.
- **iOS doesn't support Web Share Target.** WebKit ignores the
  `share_target` manifest entry on iPhone/iPad. There's no workaround
  short of a native app. On iOS, use the in-app importers (paste URL,
  paste markdown, or upload a photo with the file picker — which can
  also launch the camera via the `capture` attribute on mobile).

## License

See [LICENSE](LICENSE).
