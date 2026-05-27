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

/**
 * Render multi-paragraph text as markdown: paragraphs separated by blank
 * lines wrap in <p>, single-newline breaks inside a paragraph become <br>,
 * inline **bold** and [text](url) work via renderInlineMarkdown.
 *
 * Use for notes — anything where the user might write more than one line.
 */
export function renderMarkdownBlock(text: string): ReactNode {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim() !== "");
  return paragraphs.map((para, i) => (
    <p key={i} className={i > 0 ? "mt-2" : ""}>
      {renderParagraph(para)}
    </p>
  ));
}

function renderParagraph(text: string): ReactNode[] {
  // Single newlines inside a paragraph render as <br>, preserving visual
  // line breaks the user typed without forcing a full paragraph gap.
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${i}`} />);
    out.push(...renderInlineMarkdown(line).map((n, j) => {
      if (typeof n === "string") return n;
      // Keys would collide across lines; wrap in fragment with line index.
      return <span key={`l${i}-${j}`}>{n}</span>;
    }));
  });
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
