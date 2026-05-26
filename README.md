# RecipeTracker

A personal recipe library — installable as a PWA on desktop, Android, and iOS — with AI-assisted import.

## Features

**Capture**
- Sign in with Google or Microsoft (Firebase Auth)
- Create a recipe from scratch
- Import a recipe from a markdown file
- Import a recipe from a URL (AI-assisted via Claude)
- **Share-to-app** from the browser or another app — Android Chrome supports the Web Share Target API, so the share sheet offers RecipeTracker as a destination. *Not supported on iOS* (Safari/WebKit limitation); on iOS, copy the URL and paste it into the import screen.
- **File-handler** registration — `.md` files offer "Open with RecipeTracker" on desktop OSes that support it

**Organize**
- Sectioned ingredients (e.g. "Cake", "Frosting", "Assembly") as a bulleted list per section
- Sectioned instructions as numbered steps per section
- **Source** can be a URL **or** a book reference (title, author, page)
- Optional fields: Yield, Prep Time, Cook Time, Total Time
- Notes field for free-form annotations
- Category: Appetizer · Side · Sauce · Soup · Salad · Entrée
- Tags: Vegetarian, Gluten Free, and any others you add

**Find & share**
- Search recipes by keyword or by ingredient
- View and edit existing recipes
- Share a single recipe with another user (by email)
- **Auto-share**: grant a person blanket access to every recipe you own — applies to existing recipes and anything you add later, until you revoke it

**PWA niceties**
- Installable to home screen / desktop with a full app icon set (including maskable variants)
- Offline-capable app shell with Workbox-managed runtime caching
- Home-screen shortcuts: "New recipe", "Import from URL"
- `protocol_handlers` registration of `web+recipe:` for deep links from external apps
- `launch_handler: "navigate-existing"` so share-target activations open in the already-running window

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Vite + React + TypeScript** | Fast dev server, simple static build for Firebase Hosting |
| Routing | **React Router** | Standard SPA routing; query-param-driven `/import` route handles share-target |
| PWA tooling | **vite-plugin-pwa** | Generates manifest + Workbox service worker from `vite.config.ts` |
| Auth | **Firebase Auth** — Google + Microsoft OAuth via `signInWithRedirect` | Hosted OAuth, redirect flow avoids popup blockers on iOS |
| Database | **Cloud Firestore** | Realtime sync, per-user security rules, offline cache |
| Backend | **Firebase Cloud Functions** (TypeScript) | Hosts Claude API calls, URL fetching, share-link generation |
| AI | **Claude API** — `claude-haiku-4-5` default, `claude-sonnet-4-6` fallback | URL → structured recipe extraction via tool-use schema |
| Hosting | **Firebase Hosting** | Serves the SPA + PWA manifest + service worker |
| Repo | **pnpm workspaces** | One install, shared types between `web/` and `functions/` |

No native Android or iOS builds. No Expo, no React Native, no EAS, no Apple Developer Program. Everything ships through Firebase Hosting.

## Repo layout

```
recipe-tracker/
├── web/                            # Vite + React PWA
│   ├── public/
│   │   ├── icons/                  # 192/256/384/512 + maskable + apple-touch
│   │   └── screenshots/            # wide + narrow for install prompts
│   ├── src/
│   │   ├── routes/                 # React Router routes
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── firebase.ts
│   │   │   ├── useAuth.ts
│   │   │   ├── queryRecipes.ts
│   │   │   └── importMarkdown.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts              # vite-plugin-pwa: manifest + Workbox config
├── functions/                      # Firebase Cloud Functions (TS)
│   └── src/
│       ├── importFromUrl.ts        # Claude-powered extractor
│       ├── shareRecipe.ts
│       └── autoShare.ts
├── shared/                         # Shared types + Zod schemas
│   └── src/recipe.ts
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- Node 20+ and pnpm 9+
- Firebase CLI — `npm i -g firebase-tools`

That's it. No Android SDK, no Xcode, no Java.

## Setup

1. Clone the repo and run `pnpm install` from the root.
2. Create a Firebase project. In the console, enable:
   - **Authentication** → Google provider and Microsoft provider
   - **Firestore Database** (production mode)
   - **Cloud Functions** (Blaze plan required for outbound network calls to the Claude API)
   - **Hosting**
3. **Microsoft auth setup**: register an app in Azure AD, generate a client secret, and paste the client ID + secret into Firebase Auth's Microsoft provider config. Add `https://<your-firebase-domain>.firebaseapp.com/__/auth/handler` as a redirect URI in Azure.
4. Copy `web/.env.example` to `web/.env` and fill in the Firebase web config keys (all prefixed `VITE_FIREBASE_`).
5. Set the Anthropic API key as a Cloud Functions secret:
   ```
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
6. Deploy rules and indexes once:
   ```
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## Running locally

| Target | Command |
|---|---|
| Web dev server | `pnpm --filter web dev` → http://localhost:5173 |
| Functions emulator | `pnpm --filter functions emulate` |
| Both with Firebase emulator suite | `firebase emulators:start` |

Set `VITE_USE_EMULATOR=1` in `web/.env` to point the client at local Firebase emulators.

PWA install prompt only fires on HTTPS or `localhost`, and service workers are disabled in `vite dev` by default — to test the installed-PWA experience, run `pnpm --filter web build && pnpm --filter web preview`.

## Deploying

```
pnpm --filter web build && firebase deploy --only hosting
firebase deploy --only functions
```

## License

See [LICENSE](LICENSE).
