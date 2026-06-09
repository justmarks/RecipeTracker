/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

/**
 * `beforeinstallprompt` is non-standard but widely shipped on Chromium.
 * Augment WindowEventMap so addEventListener("beforeinstallprompt", …)
 * is typed correctly without an explicit cast.
 */
declare global {
  /**
   * Base URL of the sibling Grocery app, for the "Send to Grocery"
   * deep link. Defaults to the production host when unset.
   */
  interface ImportMetaEnv {
    readonly VITE_GROCERY_APP_URL?: string;
  }

  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
    prompt(): Promise<void>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

export {};
