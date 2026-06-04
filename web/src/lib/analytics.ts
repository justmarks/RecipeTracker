import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  type Analytics,
} from "firebase/analytics";
import { app } from "./firebase";

/**
 * Google Analytics (GA4) integration via firebase/analytics.
 *
 * Design goals:
 *   - Lazy init. We don't pay the analytics SDK download cost or pin a
 *     measurement id check until the first event fires. Recipes load
 *     and render at full speed even if analytics is slow / blocked.
 *   - Silent failure. Analytics is a quality-of-life thing for the
 *     maintainer, not a user-facing feature. If anything goes wrong —
 *     no measurement id, ad-blocker, emulator, isSupported returns
 *     false (e.g. iOS PWA without cookies) — we degrade to a no-op.
 *     A user action MUST NEVER fail because analytics broke.
 *   - No PII. We send event NAMES and small enums (e.g. import source
 *     "url" vs "image"), never emails, names, IDs of the user's own
 *     content, or recipe text.
 *
 * Initialization gates:
 *   1. `VITE_FIREBASE_MEASUREMENT_ID` env var must be set. If absent
 *      the firebase config has no `measurementId` and getAnalytics
 *      would error.
 *   2. `VITE_USE_EMULATOR=1` short-circuits to no-op so dev sessions
 *      against local Firebase don't pollute prod GA4 streams.
 *   3. `firebase/analytics.isSupported()` checks browser capabilities
 *      (cookies, IndexedDB, …). Returns false in some PWA and
 *      private-browsing contexts.
 */

let analytics: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

const isEmulator = import.meta.env.VITE_USE_EMULATOR === "1";
const hasMeasurementId = Boolean(
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
);

/**
 * Resolve the analytics instance, initializing on first call. Memoized
 * so subsequent events reuse the same instance and the
 * isSupported / getAnalytics work happens exactly once per page.
 *
 * Returns null when analytics is disabled — the caller treats null
 * as "skip this event."
 */
function ensureAnalytics(): Promise<Analytics | null> {
  if (analytics) return Promise.resolve(analytics);
  if (initPromise) return initPromise;

  if (isEmulator || !hasMeasurementId) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const supported = await isSupported();
      if (!supported) return null;
      analytics = getAnalytics(app);
      return analytics;
    } catch (err) {
      // Don't spam the console on every failed init in a long session —
      // one warning is enough for the maintainer to investigate.
      console.warn("Analytics init failed:", err);
      return null;
    }
  })();
  return initPromise;
}

/**
 * Catalog of event names we emit. Keeping them in one union prevents
 * typos and makes "what do we track?" answerable by Cmd+clicking the
 * type. GA4 lowercases + dedupes events on its side, so keep names
 * snake_case and bounded under 40 chars.
 *
 * GA4 reserves these names — DON'T reuse them as custom events:
 *   page_view, first_visit, session_start, login, sign_up, share,
 *   purchase, screen_view, search, select_content
 * We do emit `login` and `page_view` deliberately (those are the
 * recommended names for those exact actions per GA4 schema).
 */
export type AnalyticsEvent =
  // Lifecycle
  | "page_view"
  | "login"
  // Recipes
  | "recipe_created"
  | "recipe_updated"
  | "recipe_imported"
  | "recipe_favorited"
  | "recipe_unfavorited"
  | "recipe_pdf_exported"
  // Sharing
  | "recipe_shared"
  | "meal_plan_shared"
  | "autoshare_granted"
  // Meal plans
  | "meal_plan_created"
  | "meal_plan_duplicated"
  | "meal_plan_printed"
  | "recipe_added_to_plan"
  | "grocery_list_generated"
  // Library management
  | "tag_merged"
  | "tag_color_changed"
  | "chapter_created";

/**
 * Fire a single custom event. Returns immediately — the underlying
 * analytics call is async but we don't expose the promise because
 * callers should be free to ignore it. Errors are swallowed inside.
 */
export function trackEvent(
  name: AnalyticsEvent,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  void ensureAnalytics().then((a) => {
    if (!a) return;
    try {
      // Drop undefined params — GA4 stores them as the string
      // "undefined" otherwise, which dirties the dashboard.
      const cleaned = params
        ? Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined),
          )
        : undefined;
      logEvent(a, name as never, cleaned as never);
    } catch (err) {
      // Per-event failures shouldn't break subsequent calls; analytics
      // is still pointed at the cached instance for the next event.
      console.warn(`trackEvent(${name}) failed:`, err);
    }
  });
}

/**
 * Associate the signed-in user's uid with their analytics session so
 * the GA4 user-level reports can stitch sessions together for the
 * same person across devices. We deliberately use the Firebase
 * uid — an opaque identifier — never an email or name.
 *
 * Call with `null` on sign-out to detach the uid from subsequent
 * events.
 */
export function setAnalyticsUser(uid: string | null): void {
  void ensureAnalytics().then((a) => {
    if (!a) return;
    try {
      setUserId(a, uid ?? "");
    } catch (err) {
      console.warn("setAnalyticsUser failed:", err);
    }
  });
}
