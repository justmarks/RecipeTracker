# Mobile UI kit — MarksRecipeBook PWA

A pixel-recreation of the **installed-PWA** mobile experience for MarksRecipeBook on iOS / Android. Built inside an iOS 26 device frame.

## What's here

- `index.html` — design canvas showing the key mobile screens side-by-side:
  - **Sign in** — Google / Microsoft entry.
  - **Recipes (home)** — sticky title bar, search, chapter sections, recipe rows with thumbnails + ratings.
  - **Recipe detail** — full-bleed hero photo, floating back + favorite (filled-tomato heart) buttons, rating + last-made, source-URL button, **Edit · Share · PDF · Delete action row**, sectioned ingredients, numbered steps, notes card, and a bottom-sheet delete confirm.
  - **Import** — three equal method cards (URL · photo · markdown) plus the iOS share limitation tip.
  - **You** — iOS-style grouped settings list: profile row, Library (Chapters · Tags · Deleted recipes), Family sharing (members + add), App (Preferences · Help · Privacy), and Sign out.
- `screens.jsx` — all screens as React components on top of `ios-frame.jsx`.
- `mobile-primitives.jsx` — `MIcon` (with `filled`), touch-sized `MButton`, `MTag`, sheet-style `MHeader`, bottom `MTabBar`.
- `data.js` — same mock data as the web kit (shape-compatible, with `photo` / `rating` / `lastMadeDate`).
- `ios-frame.jsx` / `design-canvas.jsx` — starter components.

## Notes

- The installed PWA is **portrait-only** (`orientation: portrait-primary` in the source manifest).
- Hit targets are 44px minimum, per the design system.
- The bottom tab bar mirrors the source manifest shortcuts: **Recipes**, **Import**, **You**.
- Favorite is the floating heart (quick tap while cooking); Edit/Share/PDF/Delete live in the action row. This mirrors the web kit's action bar, adapted to touch.
- The status bar is dark text on cream.
