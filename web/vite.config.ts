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
      registerType: "autoUpdate",
      manifest: {
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
        theme_color: "#0f172a",
        background_color: "#ffffff",
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
          { src: "/screenshots/wide-1.png", sizes: "1280x720", type: "image/png", form_factor: "wide" },
          { src: "/screenshots/narrow-1.png", sizes: "750x1334", type: "image/png", form_factor: "narrow" },
        ],
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
        navigateFallbackDenylist: [/^\/__\/auth/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
