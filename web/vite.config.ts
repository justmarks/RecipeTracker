import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    headers: {
      // Allow Firebase Auth popups to communicate back across origins.
      // Without this, Chrome warns that COOP "would block" window.closed
      // polling that Firebase uses to detect the popup closing.
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own chunks so the app
        // bundle stays small and vendor chunks can be cached across
        // deploys that don't touch them.
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/functions",
          ],
          react: ["react", "react-dom", "react-router"],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" — when a new service worker is waiting, we ask the user
      // before reloading. Silent auto-update is too disruptive mid-cooking
      // (a reload would scroll the recipe back to the top while their
      // hands are wet). The UpdatePrompt component handles the toast.
      registerType: "prompt",
      manifest: {
        name: "MarksRecipeBook",
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
        // Design-system colors: tomato-500 for theme (browser chrome,
        // splash icon tint) and paper-100 for the splash background so the
        // initial paint matches the body color before React mounts.
        theme_color: "#C8553D",
        background_color: "#FBF6EE",
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
        // screenshots: intentionally omitted until we capture real ones at
        // 1280x720 (wide) and 750x1334 (narrow). Re-add the block with
        // matching files in web/public/screenshots/ when ready — the
        // install prompt still works fine without them.
        shortcuts: [
          { name: "New recipe", url: "/recipes/new" },
          { name: "Import from URL", url: "/import?via=shortcut" },
        ],
        share_target: {
          action: "/import",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
        protocol_handlers: [
          { protocol: "web+recipe", url: "/recipes/%s" },
        ],
        file_handlers: [
          { action: "/import", accept: { "text/markdown": [".md", ".markdown"] } },
        ],
        prefer_related_applications: false,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // SPA navigation falls back to the cached index.html so deep
        // links work offline. Skip Firebase Auth's iframe handler and
        // any /api/* paths — they must always hit the network.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/__\/auth/, /^\/api\//],
        // Bump the precache size budget so the variable Newsreader
        // and Manrope font files fit comfortably in the app shell.
        // Without this Workbox refuses to precache files > 2 MiB.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Include fonts and other public assets the default globs miss.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf}"],
        runtimeCaching: [
          {
            // Firebase Storage recipe photos — cache once seen so the
            // user can still see them offline. SWR keeps them fresh
            // without blocking the UI when the network comes back.
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "recipe-photos",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Externally-hosted recipe photos (Unsplash, NYT, etc.) that
            // owners may have pasted as photoUrl. Lighter cache, shorter
            // TTL — these are someone else's CDN.
            urlPattern: /\.(?:png|jpg|jpeg|webp|gif|avif)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "external-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
