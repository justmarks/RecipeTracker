import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button, Icon } from "./ui";

/**
 * Three PWA affordances rolled into one mount point so they all sit
 * at the page-bottom z-stack without fighting for layout:
 *
 *   - "New version available — Reload" toast (vite-plugin-pwa onNeedRefresh)
 *   - "Ready to use offline" one-shot toast (vite-plugin-pwa onOfflineReady)
 *   - "Install Recipe Book" button using the deferred beforeinstallprompt
 *     event from Chromium-based browsers
 *
 * Placed once inside <Layout /> — survives route changes and never
 * unmounts mid-toast.
 */
export function PwaPrompts() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      // Poll for SW updates every hour while the tab is alive. The
      // browser will also check on its own on navigation, but periodic
      // polling catches the case of a long-lived "PWA on a laptop"
      // session where the user never closes the window.
      if (reg) {
        setInterval(() => {
          reg.update().catch(() => {
            /* offline; try again next tick */
          });
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(err) {
      console.error("SW registration failed:", err);
    },
  });

  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  // Dismissal is persisted to localStorage so subsequent loads (every
  // SW update used to re-show this toast) don't re-prompt the user
  // who's already said "no thanks." Read once on mount and never
  // re-check — once dismissed in this browser, the toast is gone for
  // good. (Users who change their mind can still install via the
  // browser's own menu.)
  const [dismissed, setDismissed] = useState(() => readInstallDismissed());

  // Capture the install prompt so we can show a button when the
  // browser would otherwise show its own non-discoverable hint.
  useEffect(() => {
    function onBeforeInstall(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setInstallEvent(e);
    }
    function onAppInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    // Either way the event can only be used once.
    setInstallEvent(null);
  }

  function reload() {
    // Two failure modes we're guarding against:
    //   1. updateServiceWorker(true) installs a `controllerchange`
    //      listener but if there's no waiting SW (because it already
    //      activated, or because the registration doesn't expose one
    //      at this moment), the listener never fires and the click
    //      appears to do nothing.
    //   2. Browser timing where `controllerchange` was missed by the
    //      late-attached listener.
    // Either way, a guaranteed-fallback reload after a short delay
    // (long enough for the SW handoff to complete in the happy path,
    // short enough to feel responsive) ensures the user always gets
    // the new bundle.
    updateServiceWorker(true).catch((err) => {
      console.error("SW update failed:", err);
    });
    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  return (
    <>
      {/* Update available — sits above any sticky form action bar (z-50). */}
      {needRefresh && (
        <PromptBanner
          tone="brand"
          icon="sparkles"
          message="A new version of Recipe Book is ready."
          primaryLabel="Reload"
          onPrimary={reload}
          onDismiss={() => setNeedRefresh(false)}
        />
      )}

      {/* Offline-ready confirmation — silent on first install would be
          confusing on a freshly-saved-to-homescreen PWA. Auto-dismisses
          after 5s via a useEffect inside PromptBanner. */}
      {offlineReady && !needRefresh && (
        <PromptBanner
          tone="olive"
          icon="check"
          message="Recipe Book is ready to use offline."
          onDismiss={() => setOfflineReady(false)}
          autoHideMs={5000}
        />
      )}

      {/* Install affordance — only shown when the browser fired
          beforeinstallprompt AND we haven't already installed AND
          the user hasn't previously dismissed the prompt. */}
      {installEvent && !installed && !dismissed && (
        <PromptBanner
          tone="paper"
          icon="bookmark"
          message="Install Recipe Book to your home screen."
          primaryLabel="Install"
          onPrimary={handleInstall}
          onDismiss={() => {
            setInstallEvent(null);
            setDismissed(true);
            writeInstallDismissed();
          }}
        />
      )}
    </>
  );
}

// Persisted dismissal of the "Install Recipe Book" toast. Stored in
// localStorage so it survives reloads, SW updates, and tab restarts.
// Wrapped in try/catch because localStorage can throw in private-mode
// or strict-privacy browser contexts — falling through to "not
// dismissed" is the safe default.
const INSTALL_DISMISSED_KEY = "mrb:installPromptDismissed";

function readInstallDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeInstallDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  } catch {
    // No-op: dismissal won't persist, but the in-memory state still
    // hides the toast for the current session.
  }
}

interface PromptBannerProps {
  tone: "brand" | "olive" | "paper";
  icon: "sparkles" | "check" | "bookmark";
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  onDismiss: () => void;
  /** When set, banner auto-dismisses after this many ms. */
  autoHideMs?: number;
}

const TONE_CLASSES: Record<PromptBannerProps["tone"], string> = {
  brand: "bg-tomato-500 text-white",
  olive: "bg-olive-500 text-white",
  paper: "bg-ink-900 text-paper-100",
};

function PromptBanner({
  tone,
  icon,
  message,
  primaryLabel,
  onPrimary,
  onDismiss,
  autoHideMs,
}: PromptBannerProps) {
  useEffect(() => {
    if (!autoHideMs) return;
    const t = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [autoHideMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        // Lifted above the mobile tab bar (~80px tall with iOS safe
        // area) and falls back to a closer-to-the-edge bottom-4 on
        // desktop where no tab bar exists.
        "fixed bottom-24 lg:bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg",
        "font-sans text-sm max-w-[92vw]",
        TONE_CLASSES[tone],
      ].join(" ")}
    >
      <span className="shrink-0">
        <Icon name={icon} size={16} />
      </span>
      <span className="flex-1 min-w-0">{message}</span>
      {primaryLabel && onPrimary && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPrimary}
          className="!bg-white/15 !text-white !border-white/30 hover:!bg-white/25"
        >
          {primaryLabel}
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-white/70 hover:text-white p-1"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
