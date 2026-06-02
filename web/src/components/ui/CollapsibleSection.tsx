import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface CollapsibleSectionProps {
  /** Heading text, rendered as an h2 in Newsreader medium. */
  title: string;
  /** Whether the panel is expanded. Controlled — parent owns the state. */
  open: boolean;
  /** Fired when the user clicks the header to toggle. */
  onToggle: () => void;
  /** Optional right-side action buttons (e.g. "Add adult", "Add kid"). */
  actions?: ReactNode;
  /** Optional muted summary shown next to the title. By default it
   *  only appears when the section is collapsed (the open content
   *  shows the detail already). Set `alwaysShowSummary` to keep it
   *  visible at all times — useful for counts that the user wants
   *  at a glance even with the section open. */
  summary?: ReactNode;
  /** Show the summary even when the section is expanded. Defaults
   *  to false. */
  alwaysShowSummary?: boolean;
  /** Extra classes on the outer section. Used by print scopes (e.g.
   *  `prep-list`, `additional-items`) so existing CSS rules still
   *  match. */
  className?: string;
  children: ReactNode;
}

/**
 * A bordered section with a click-to-collapse header. The header
 * shows a rotating chevron + the title + an optional one-line summary
 * (e.g. "3 adults · 2 kids") + right-aligned action buttons that stay
 * clickable while collapsed.
 *
 * The animated panel uses the `grid-template-rows: 1fr → 0fr` trick
 * which interpolates a height-fit collapse without JavaScript
 * measurement and survives dynamic content height changes. A print
 * media override (in index.css) forces the panel open on paper so a
 * collapsed section still appears in the printed meal plan.
 */
export function CollapsibleSection({
  title,
  open,
  onToggle,
  actions,
  summary,
  alwaysShowSummary = false,
  className = "",
  children,
}: CollapsibleSectionProps) {
  return (
    <section className={`collapsible-section ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={[
            "flex-1 min-w-0 flex items-center gap-2 text-left",
            "rounded -mx-1.5 px-1.5 py-1 -my-1",
            "hover:bg-paper-200 transition-colors duration-100",
            "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
            // Print: hide the click affordance (no hover state on
            // paper, and the chevron rotation is meaningless once
            // every panel renders open).
            "print:bg-transparent print:hover:bg-transparent",
          ].join(" ")}
        >
          <Icon
            name="chevron-right"
            size={18}
            className={[
              "text-ink-500 shrink-0 transition-transform duration-200",
              open ? "rotate-90" : "",
              "print:hidden",
            ].join(" ")}
          />
          <h2 className="font-display text-xl font-medium text-ink-900 m-0 truncate">
            {title}
          </h2>
          {summary && (
            <span
              className={[
                "font-sans text-xs text-ink-500 truncate",
                // Hide the summary when expanded unless the caller
                // explicitly asked to keep it visible. Always show
                // on print so a printed meal plan has the at-a-glance
                // count next to the heading regardless of mode.
                open && !alwaysShowSummary ? "hidden print:inline" : "",
              ].join(" ")}
            >
              {summary}
            </span>
          )}
        </button>
        {actions && (
          <div className="flex gap-2 print:hidden shrink-0">{actions}</div>
        )}
      </div>
      <div
        className="collapsible-panel"
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease",
        }}
        aria-hidden={!open}
      >
        <div style={{ overflow: "hidden" }}>{children}</div>
      </div>
    </section>
  );
}
