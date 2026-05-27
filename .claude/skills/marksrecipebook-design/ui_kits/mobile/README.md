# Mobile UI kit — MarksRecipeBook PWA

A pixel-recreation of the **installed-PWA** mobile experience for MarksRecipeBook on iOS / Android. Built inside an iOS 26 device frame.

## What's here

- `index.html` — design canvas showing the key mobile screens side-by-side:
  - **Sign in** — Google / Microsoft entry.
  - **Recipes (home)** — sticky title bar, search, chapter sections, recipe rows.
  - **Recipe detail** — cookbook-style typography, eyebrow, big title, sectioned ingredients with bullets, numbered steps in italic, notes card.
  - **Import** — URL → AI fetcher, share-target preview state.
  - **Chapters** — reorder / rename / delete.
- `screens.jsx` — all 5 screens as React components on top of `ios-frame.jsx`.
- `mobile-primitives.jsx` — touch-sized buttons, list rows, sheet-style headers, bottom tab bar.
- `data.js` — the same mock data as the web kit (shape-compatible).
- `ios-frame.jsx` — starter iOS 26 device frame.
- `design-canvas.jsx` — starter canvas used to present the screens.

## Notes

- The installed PWA is **portrait-only** (`orientation: portrait-primary` in the source manifest).
- Hit targets are 44px minimum, per the design system.
- The bottom tab bar mirrors the source manifest shortcuts: **Recipes**, **Import**, **You** (settings + chapters + auto-share).
- The status bar is dark text on cream — a design choice that matches `apple-mobile-web-app-status-bar-style: default`.
