import { Link, Outlet } from "react-router";
import { Brand } from "./Brand";
import { MobileTabBar } from "./MobileTabBar";
import { Sidebar } from "./Sidebar";
import { PwaPrompts } from "./PwaPrompts";

/**
 * Signed-in shell. Two distinct shapes by breakpoint:
 *
 *   < lg  — mobile / tablet:
 *           sticky top bar with the Brand lockup only (no hamburger),
 *           main content, fixed bottom <MobileTabBar /> with three
 *           tabs: Recipes · Import · You.
 *
 *   ≥ lg  — desktop:
 *           classic two-column shell — sticky <Sidebar /> on the
 *           left (260px), main content fills the rest.
 *
 * The earlier slide-in mobile drawer is gone — the design system's
 * mobile spec moved from drawer to tab-bar (see
 * `.claude/skills/marksrecipebook-design/ui_kits/mobile/README.md`).
 * Sidebar is desktop-only now; all the same destinations are reachable
 * from the tab bar's You tab (Account → Manage chapters, Sharing,
 * Sign out).
 *
 * The main column gets `pb-24 lg:pb-0` so its content clears the
 * ~80px-tall mobile tab bar (which includes iOS safe-area inset).
 */
export function Layout() {
  return (
    <div className="min-h-screen bg-paper-100">
      {/* Mobile top bar — brand only. The hamburger is gone with the
          drawer; mobile navigation lives in the bottom tab bar now. */}
      <div className="sticky top-0 z-30 lg:hidden print:hidden flex items-center px-4 py-3 border-b border-paper-300 bg-paper-50">
        <Link to="/" className="no-underline min-w-0">
          <Brand size={28} />
        </Link>
      </div>

      {/* Desktop layout — sidebar + main side by side. */}
      <div className="lg:flex">
        <div className="hidden lg:block print:hidden">
          <Sidebar />
        </div>
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* PWA affordances (update toast, offline-ready toast, install
          button). Mounted once at the shell level so they survive
          route changes. */}
      <div className="print:hidden">
        <PwaPrompts />
      </div>

      {/* Bottom tab bar — mobile only, self-hides above lg + on print. */}
      <MobileTabBar />
    </div>
  );
}
