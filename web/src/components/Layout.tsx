import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Brand } from "./Brand";
import { Sidebar } from "./Sidebar";

/**
 * The signed-in shell. Sidebar on the left at lg+, slide-in drawer
 * via a top-bar hamburger below lg. <Outlet /> renders the matched
 * child route.
 *
 * Closes the drawer automatically on route changes (so navigating
 * from inside the drawer leaves nothing stranded). Esc also closes.
 */
export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Auto-close drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  // Close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-paper-100">
      {/* Mobile top bar — visible only below lg */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-paper-300 bg-paper-50">
        <Link to="/" className="no-underline min-w-0">
          <Brand size={28} />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-2 text-ink-700 hover:text-ink-900 rounded-md hover:bg-paper-200 transition-colors duration-100"
        >
          <MenuIcon />
        </button>
      </div>

      {/* Desktop layout — sidebar + main side by side */}
      <div className="lg:flex">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink-900/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden shadow-lg">
            <Sidebar
              onNavigate={() => setDrawerOpen(false)}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Three-line hamburger icon. Not in the Icon set because it's only
 * used here — keep the Icon library focused on app-level icons.
 */
function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
