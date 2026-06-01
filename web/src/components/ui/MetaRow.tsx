import type { CSSProperties } from "react";

interface MetaItem {
  label: string;
  value: string;
}

interface MetaRowProps {
  items: MetaItem[];
  className?: string;
}

/**
 * A row of label / value pairs above a recipe — Yield, Prep, Cook, Total.
 * Labels are tiny eyebrows; values are JetBrains Mono with tabular-num
 * so columns of "45 min" / "1 hr 30 min" line up cleanly.
 *
 * Grid auto-sizes to `items.length` so a recipe with only Yield + Prep
 * uses two columns, not four. Pass empty array → component renders
 * nothing (caller should already guard for that case).
 */
export function MetaRow({ items, className = "" }: MetaRowProps) {
  if (items.length === 0) return null;
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
  };
  return (
    <dl className={`m-0 grid gap-4 ${className}`} style={style}>
      {items.map((item, i) => (
        <div key={i}>
          <dt className="m-0 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
            {item.label}
          </dt>
          <dd className="m-0 mt-0.5 font-mono text-sm text-ink-900 [font-feature-settings:'tnum']">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
