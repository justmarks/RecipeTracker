import type { ReactNode } from "react";

/**
 * Render a string that may contain **bold** and [label](url) into React nodes.
 * Intentionally narrow scope — recipe text rarely needs italics, code blocks,
 * or other markdown features. URLs go through a prefix allowlist so we can't
 * be used to render `javascript:` or `data:` vectors.
 *
 * Returns an array of nodes suitable for spreading into JSX children:
 *   <li>{renderInlineMarkdown(item)}</li>
 */
export function renderInlineMarkdown(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;

  // Either **bold** (lazy match so we don't eat across siblings)
  // or [label](url)
  const pattern = /\*\*([^*]+?)\*\*|\[([^\]]+?)\]\(([^)]+?)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      out.push(text.slice(lastIdx, match.index));
    }

    if (match[1] !== undefined) {
      out.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const label = match[2];
      const url = match[3];
      if (isSafeUrl(url)) {
        out.push(
          <a
            key={key++}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-600 underline"
          >
            {label}
          </a>,
        );
      } else {
        // Unsafe scheme — drop the link entirely, render the label as plain text.
        out.push(label);
      }
    }

    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    out.push(text.slice(lastIdx));
  }

  return out;
}

function isSafeUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:")
  );
}
