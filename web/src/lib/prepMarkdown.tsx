import type { ReactNode } from "react";
import { isSafeUrl } from "./inlineMarkdown";

/**
 * Block-level markdown renderer for meal-plan prep notes. Supports
 * the subset the user asked for:
 *
 *   #, ##, ### …      → section headings
 *   - item, * item    → bullet lists
 *   1. item           → numbered lists
 *   - [ ], - [x]      → task checkboxes (interactive when onToggleTask is provided)
 *   **bold**          → <strong>
 *   *italic*          → <em>
 *   [label](url)      → links (URL safety enforced via isSafeUrl)
 *
 * Intentionally narrow vs. CommonMark — no horizontal rules, code
 * blocks, blockquotes, images. Those aren't on the prep-notes brief
 * and adding them would complicate the editor without payoff.
 *
 * The renderer takes the SOURCE STRING (not a pre-parsed AST) so it
 * can attach source-line indices to task checkboxes. When the user
 * clicks a rendered checkbox, the parent toggles `[ ]` ↔ `[x]` for
 * that exact line in the source — keeping the markdown buffer as the
 * single source of truth.
 */
export function renderPrepMarkdown(
  source: string,
  onToggleTask?: (lineIndex: number) => void,
): ReactNode {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Heading line.
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      blocks.push(
        renderHeading(level, headingMatch[2].trim(), key++),
      );
      i++;
      continue;
    }

    // List run (bullets, numbers, or tasks). collectList grabs every
    // consecutive list line of the same shape.
    const listKind = listKindFor(trimmed);
    if (listKind) {
      const { items, endIdx } = collectList(lines, i, listKind);
      blocks.push(renderList(listKind, items, key++, onToggleTask));
      i = endIdx;
      continue;
    }

    // Paragraph — collect contiguous non-special lines.
    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === "") break;
      if (/^#{1,6}\s/.test(t)) break;
      if (listKindFor(t)) break;
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p
          key={key++}
          className="mt-3 first:mt-0 leading-relaxed text-ink-900"
        >
          {renderInline(paraLines.join("\n"))}
        </p>,
      );
    }
  }

  return <>{blocks}</>;
}

type ListKind = "ul" | "ol" | "task";

/**
 * Returns the list-line kind for `trimmed` (or null if it isn't one).
 * The task variant is recognized by a bullet line that immediately
 * begins with `[ ]` or `[x]` — anything else is a normal bullet.
 */
function listKindFor(trimmed: string): ListKind | null {
  if (/^[-*]\s\[[ xX]\]\s?/.test(trimmed)) return "task";
  if (/^[-*]\s/.test(trimmed)) return "ul";
  if (/^\d+\.\s/.test(trimmed)) return "ol";
  return null;
}

interface ListItem {
  /** The text after the marker — what gets rendered with inline markdown. */
  text: string;
  /** Source-line index (0-based). Used to toggle task state. */
  srcIdx: number;
  /** For task items only — true when `[x]`. */
  done?: boolean;
}

function collectList(
  lines: string[],
  start: number,
  kind: ListKind,
): { items: ListItem[]; endIdx: number } {
  const items: ListItem[] = [];
  let i = start;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (t === "") break;
    if (listKindFor(t) !== kind) break;

    if (kind === "task") {
      // Strip the bullet marker AND the [ ] / [x] prefix; record done.
      const m = t.match(/^[-*]\s\[([ xX])\]\s?(.*)$/);
      if (!m) break;
      items.push({
        text: m[2],
        srcIdx: i,
        done: m[1] === "x" || m[1] === "X",
      });
    } else if (kind === "ul") {
      const m = t.match(/^[-*]\s+(.*)$/);
      if (!m) break;
      items.push({ text: m[1], srcIdx: i });
    } else {
      const m = t.match(/^\d+\.\s+(.*)$/);
      if (!m) break;
      items.push({ text: m[1], srcIdx: i });
    }
    i++;
  }
  return { items, endIdx: i };
}

function renderHeading(level: number, text: string, key: number): ReactNode {
  // Headings inherit the editorial Newsreader style. Level controls
  // size: H1 close to the page-section heading, smaller for deeper
  // nesting. mt-4 first:mt-0 gives breathing room without orphaning
  // the first heading at the top of the rendered block.
  const sizes: Record<number, string> = {
    1: "text-xl mt-4",
    2: "text-lg mt-4",
    3: "text-base mt-3",
    4: "text-sm mt-2",
    5: "text-sm mt-2",
    6: "text-sm mt-2",
  };
  const cls = [
    "font-display font-medium text-ink-900 leading-tight",
    "first:mt-0",
    sizes[level],
  ].join(" ");
  switch (level) {
    case 1:
      return <h1 key={key} className={cls}>{renderInline(text)}</h1>;
    case 2:
      return <h2 key={key} className={cls}>{renderInline(text)}</h2>;
    case 3:
      return <h3 key={key} className={cls}>{renderInline(text)}</h3>;
    case 4:
      return <h4 key={key} className={cls}>{renderInline(text)}</h4>;
    case 5:
      return <h5 key={key} className={cls}>{renderInline(text)}</h5>;
    default:
      return <h6 key={key} className={cls}>{renderInline(text)}</h6>;
  }
}

function renderList(
  kind: ListKind,
  items: ListItem[],
  key: number,
  onToggleTask?: (lineIndex: number) => void,
): ReactNode {
  if (kind === "task") {
    return (
      <ul key={key} className="list-none m-0 p-0 mt-2 first:mt-0">
        {items.map((it) => (
          <li
            key={it.srcIdx}
            className="flex items-start gap-2 my-1.5"
            data-done={it.done ? "true" : "false"}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={!!it.done}
              onClick={
                onToggleTask
                  ? () => onToggleTask(it.srcIdx)
                  : undefined
              }
              disabled={!onToggleTask}
              className={[
                "flex-none mt-1 w-4 h-4 rounded border-2 flex items-center justify-center",
                "transition-colors duration-100",
                onToggleTask ? "cursor-pointer" : "cursor-default",
                it.done
                  ? "bg-tomato-500 border-tomato-500 text-white"
                  : "bg-white border-paper-400 text-transparent",
                "print:border-ink-700 print:text-ink-900",
              ].join(" ")}
              aria-label={it.done ? "Mark as not done" : "Mark as done"}
            >
              {/* Check glyph — solid filled on done, hidden via
                  color-transparent otherwise so the square reads
                  clearly. ASCII rather than icon imports keep this
                  renderer self-contained. */}
              <span aria-hidden="true" className="text-[10px] leading-none">
                ✓
              </span>
            </button>
            <span
              className={[
                "flex-1 leading-snug",
                it.done ? "line-through text-ink-500" : "text-ink-900",
              ].join(" ")}
            >
              {renderInline(it.text)}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "ul") {
    return (
      <ul
        key={key}
        className="list-disc list-outside pl-6 m-0 mt-2 first:mt-0 marker:text-tomato-500"
      >
        {items.map((it) => (
          <li key={it.srcIdx} className="my-1 text-ink-900 leading-snug">
            {renderInline(it.text)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ol
      key={key}
      className="list-decimal list-outside pl-6 m-0 mt-2 first:mt-0 marker:text-tomato-500 marker:font-medium"
    >
      {items.map((it) => (
        <li key={it.srcIdx} className="my-1 text-ink-900 leading-snug">
          {renderInline(it.text)}
        </li>
      ))}
    </ol>
  );
}

/**
 * Inline renderer for a single text run. Bold > italic > link. Bold
 * is matched first so `**foo**` doesn't get caught by the italic
 * pattern as `*` `foo` `*`.
 */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  // Bold OR italic OR link. The bold pattern must precede italic in
  // the alternation so the engine prefers the longer match.
  const pattern =
    /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|\[([^\]]+?)\]\(([^)]+?)\)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(text.slice(lastIdx, m.index));
    }
    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<em key={key++}>{m[2]}</em>);
    } else if (m[3] !== undefined && m[4] !== undefined) {
      const label = m[3];
      const url = m[4];
      if (isSafeUrl(url)) {
        out.push(
          <a
            key={key++}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-tomato-600 underline hover:text-tomato-700"
          >
            {label}
          </a>,
        );
      } else {
        out.push(label);
      }
    }
    lastIdx = pattern.lastIndex;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}

/**
 * Toggle the checkbox on `lineIndex` of `source` between `[ ]` and
 * `[x]`. Returns the new source string. Used as the natural
 * `onToggleTask` implementation by the prep-notes editor — passing
 * `source` plus this function keeps state ownership with the
 * caller.
 */
export function toggleTaskInSource(
  source: string,
  lineIndex: number,
): string {
  const lines = source.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return source;
  const line = lines[lineIndex];
  const replaced = line.replace(
    /^(\s*[-*]\s)\[([ xX])\](\s?)/,
    (_full, prefix, mark, gap) =>
      `${prefix}[${mark === " " ? "x" : " "}]${gap || " "}`,
  );
  if (replaced === line) return source;
  lines[lineIndex] = replaced;
  return lines.join("\n");
}
