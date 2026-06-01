import { Link, useLocation } from "react-router";
import { Icon } from "./ui";
import type { IconName } from "./ui";

/**
 * Bottom tab bar shown below `lg` per the design system's mobile shell
 * spec (mobile UI kit / README → "tab-bar is the intended future").
 * Three tabs: Recipes / Import / You. Replaces the earlier mobile
 * drawer pattern entirely — there's no hamburger on the top bar now.
 *
 * Active state is route-prefix based so deep links inside a tab (e.g.
 * `/recipes/abc/edit`) keep the right tab lit. Tab destinations:
 *   Recipes → `/`         (also `/?favorites=1`, `/?view=other`, chapter scopes)
 *   Import  → `/import`
 *   You     → `/account`  (settings hub with sharing + chapters + sign out)
 *
 * Styled to match `ui_kits/mobile/mobile-primitives.jsx` MTabBar:
 * translucent paper-100 with backdrop-blur, hairline ink-100 top
 * border, generous bottom padding to clear the iOS home indicator
 * (`safe-area-inset-bottom` with a 30px floor).
 */
interface Tab {
  id: "recipes" | "import" | "you";
  label: string;
  icon: IconName;
  to: string;
}

const TABS: Tab[] = [
  { id: "recipes", label: "Recipes", icon: "book-open", to: "/" },
  { id: "import", label: "Import", icon: "sparkles", to: "/import" },
  { id: "you", label: "You", icon: "user", to: "/account" },
];

function activeTabId(pathname: string): Tab["id"] {
  // Recipes tab covers the cookbook root + every recipe-shaped route.
  if (
    pathname === "/" ||
    pathname.startsWith("/recipes")
  ) {
    return "recipes";
  }
  // Import covers /import and its share-target variants (?via=...).
  if (pathname.startsWith("/import")) {
    return "import";
  }
  // You = account hub + the settings pages it links into. Chapters
  // and sharing are reachable from the You tab, so they keep it lit.
  if (
    pathname.startsWith("/account") ||
    pathname.startsWith("/chapters") ||
    pathname.startsWith("/settings")
  ) {
    return "you";
  }
  // Fallback: highlight Recipes for any unexpected route — better than
  // showing nothing active.
  return "recipes";
}

export function MobileTabBar() {
  const { pathname } = useLocation();
  const active = activeTabId(pathname);

  return (
    <nav
      aria-label="Primary"
      className={[
        "fixed bottom-0 left-0 right-0 z-30",
        "lg:hidden print:hidden",
        "flex justify-around",
        "border-t border-[var(--border-faint)]",
        // Translucent cream with backdrop blur — the one place the
        // design system permits backdrop-filter blur (pass-through
        // chrome where content scrolls beneath).
        "bg-[rgba(251,246,238,0.92)] backdrop-blur-md",
        "pt-2",
      ].join(" ")}
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 30px)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            aria-current={isActive ? "page" : undefined}
            className={[
              "flex flex-col items-center gap-0.5 px-3.5 py-1.5",
              "no-underline transition-colors duration-100",
              isActive
                ? "text-tomato-500"
                : "text-ink-500 hover:text-ink-700",
            ].join(" ")}
          >
            <Icon name={tab.icon} size={24} />
            <span
              className={[
                "font-sans text-[11px]",
                isActive ? "font-semibold" : "font-medium",
              ].join(" ")}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
