# scripts/

Standalone Node.js utilities. Not part of the web/functions deploy.

## `import-folder.mjs` — bulk import markdown recipes

Walk a directory tree, parse every `.md` file as a recipe, write each to
Firestore. **The immediate parent folder name becomes the chapter** —
e.g. `Appetizers/Artichoke Dip.md` ends up in the `appetizers` chapter.

Uses Firebase **Admin SDK**, which bypasses security rules. Don't share
your service-account key.

### One-time setup

1. **Install** the Admin SDK locally:
   ```
   cd scripts
   npm install
   ```
2. **Service account key**: Firebase Console → Project settings → Service
   accounts → Generate new private key. Save the downloaded JSON as
   `scripts/service-account.json` (gitignored), or set
   `FIREBASE_SERVICE_ACCOUNT` to its path.
3. **Find your UID**: Firebase Console → Authentication → Users → copy
   the UID for your account (long random string).

### Run

```
node scripts/import-folder.mjs "C:\path\to\recipes" <your-uid>
```

Or, on Windows PowerShell:

```
.\scripts\import-folder.ps1 -Path "C:\path\to\recipes" -Uid <your-uid>
```

Each file logs `OK <relpath> → <chapter> (<docId>)`. Files without a
detected title are skipped.

### What it parses

Same conventions as the in-app markdown importer
(`web/src/lib/importMarkdown.ts`):

- `# Title` → title (required; file is skipped without it)
- Optional `Key: value` metadata above the first section header:
  `Source`, `Yield`, `Prep`, `Cook`, `Total`, `Tags`, `Category`,
  `Photo` / `Image`, `Rating`, `Last made`
- `## Ingredients` / `## Directions` (or aliases) — section bodies
  accept bullets, numbers, or one-per-paragraph items
- `### Sub-heading` or unmarked-line-among-bullets → sub-sections
  (e.g. "For the Sauce")
- `## Notes` → free-form notes

Chapter comes from the parent folder name, **overriding** any
`Category:` line in the markdown. If you want different categorization,
move the file or change the folder name first.

### Caveats

- **No security rules.** Admin SDK bypasses them. Don't run with a key
  you'd be sad to leak.
- **No duplicate check.** Re-running creates duplicate documents. If you
  need to re-import, delete the prior recipes first.
- **Chapter is auto-lowercased.** "Appetizers/" becomes the `appetizers`
  chapter. The chapter list (`users/{uid}.categories`) is **not**
  auto-updated — if the folder name doesn't match an existing chapter,
  the imported recipes appear under "Other" in the Home view until you
  add the chapter via the in-app Chapters management UI.
