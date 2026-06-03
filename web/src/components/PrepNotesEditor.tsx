import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import {
  renderPrepMarkdown,
  toggleTaskInSource,
} from "../lib/prepMarkdown";

interface PrepNotesEditorProps {
  value: string;
  onChange: (next: string) => void;
}

type Mode = "write" | "preview";

/**
 * Tabbed markdown editor for meal-plan prep notes. "Write" exposes a
 * raw textarea with a formatting toolbar; "Preview" renders the live
 * document with interactive task checkboxes. Switching tabs preserves
 * the buffer — we never re-parse, just re-render.
 *
 * Defaults to Preview when the buffer already has content (the user
 * is most often returning to check off items they previously wrote);
 * defaults to Write when the buffer is empty.
 *
 * Clicking a rendered checkbox in Preview mode rewrites the source
 * string via toggleTaskInSource, which propagates through onChange to
 * the parent's debounced save effect — same path as text edits.
 */
export function PrepNotesEditor({ value, onChange }: PrepNotesEditorProps) {
  const [mode, setMode] = useState<Mode>(value.trim() ? "preview" : "write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // When the component mounts before async data arrives (plan detail
  // hydration), value is "" so useState picks "write". This effect
  // fires the one time value transitions from empty → non-empty and
  // mirrors the initial-state logic, switching to preview automatically.
  const didAutoSwitch = useRef(false);
  useEffect(() => {
    if (!didAutoSwitch.current && value.trim()) {
      didAutoSwitch.current = true;
      setMode("preview");
    }
  }, [value]);

  // Run a textarea-modifying action; the action returns the new value
  // and a desired selection range, and we restore focus + selection on
  // the next frame so React has flushed the new value.
  //
  // Two subtleties keep the scroll position stable:
  //   1. We capture `scrollTop` BEFORE the React update, then restore
  //      it on the next frame. Some Webkit builds reset scroll on
  //      value changes to a controlled textarea.
  //   2. `focus({ preventScroll: true })` keeps the browser from
  //      scrolling the textarea to bring the caret into view — left
  //      to its own devices, clicking a toolbar button (which moves
  //      focus to the button briefly) and then re-focusing the
  //      textarea makes the page snap back to the top of the field.
  function runAction(
    action: (ta: HTMLTextAreaElement) => TextareaPatch | null,
  ) {
    const ta = textareaRef.current;
    if (!ta) return;
    const savedScroll = ta.scrollTop;
    const patch = action(ta);
    if (!patch) return;
    onChange(patch.value);
    requestAnimationFrame(() => {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(patch.selStart, patch.selEnd);
      ta.scrollTop = savedScroll;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+B → bold, Cmd/Ctrl+I → italic. We intercept BEFORE the
    // browser interprets the keystroke so a stray browser default
    // (some platforms map Ctrl+B to something) doesn't fire.
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      runAction((ta) => wrapSelection(ta, "**", "**", "bold"));
    } else if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      runAction((ta) => wrapSelection(ta, "*", "*", "italic"));
    } else if (e.key === "k" || e.key === "K") {
      e.preventDefault();
      runAction((ta) => insertLink(ta));
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Prep notes editor mode"
        className="inline-flex rounded-md border border-paper-400 bg-white p-0.5 mb-3 print:hidden"
      >
        <TabButton
          active={mode === "write"}
          onClick={() => setMode("write")}
        >
          Write
        </TabButton>
        <TabButton
          active={mode === "preview"}
          onClick={() => setMode("preview")}
        >
          Preview
        </TabButton>
      </div>

      {mode === "write" ? (
        <>
          <MarkdownToolbar runAction={runAction} />
          <textarea
            ref={textareaRef}
            rows={10}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            className={[
              "w-full text-ink-900 bg-white font-mono text-sm",
              "border border-paper-400 rounded-md px-3 py-2.5",
              "outline-none resize-y transition-colors duration-100 ease-out",
              "focus:border-tomato-500 focus:shadow-[var(--shadow-focus)]",
              "placeholder:text-ink-300",
              "print:hidden",
            ].join(" ")}
          />
        </>
      ) : value.trim() === "" ? (
        <p className="font-sans text-sm text-ink-500 m-0">
          Nothing here yet. Switch to <strong>Write</strong> and start
          typing — use the toolbar for headers, lists, tasks, and links.
        </p>
      ) : (
        <div className="prep-notes-preview">
          {renderPrepMarkdown(value, (lineIdx) =>
            onChange(toggleTaskInSource(value, lineIdx)),
          )}
        </div>
      )}

      {/* Print fallback — always render the preview on paper, even
          if the user left the editor on the Write tab. The textarea
          itself is print:hidden so we don't double-print. */}
      <div className="hidden print:block prep-notes-preview">
        {renderPrepMarkdown(value)}
      </div>
    </div>
  );
}

const PLACEHOLDER = `## Day before
- [ ] Brine the turkey
- [ ] Make pie crust
  - [ ] Roll out
  - [ ] Blind bake

## Day of
- [ ] Roast turkey at noon
- [ ] Reheat sides
- [ ] Set the table`;

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "px-3 py-1 rounded text-xs font-sans font-semibold transition-colors duration-100",
        active ? "bg-tomato-500 text-white" : "text-ink-700 hover:bg-paper-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

interface MarkdownToolbarProps {
  runAction: (
    action: (ta: HTMLTextAreaElement) => TextareaPatch | null,
  ) => void;
}

/**
 * Formatting buttons above the textarea. Grouped by family with thin
 * dividers between groups so the toolbar reads as: blocks | inline |
 * lists | link. Each button delegates to runAction, which holds the
 * textarea ref and reapplies focus/selection after React updates.
 */
function MarkdownToolbar({ runAction }: MarkdownToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={[
        "flex flex-wrap items-center gap-1 mb-2 print:hidden",
        "rounded-md border border-paper-300 bg-paper-50 px-1.5 py-1",
      ].join(" ")}
    >
      <ToolbarBtn
        title="Heading 2"
        ariaLabel="Heading 2"
        onClick={() => runAction((ta) => prefixLines(ta, "## "))}
      >
        H2
      </ToolbarBtn>
      <ToolbarBtn
        title="Heading 3"
        ariaLabel="Heading 3"
        onClick={() => runAction((ta) => prefixLines(ta, "### "))}
      >
        H3
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn
        title="Bold (Cmd/Ctrl+B)"
        ariaLabel="Bold"
        onClick={() => runAction((ta) => wrapSelection(ta, "**", "**", "bold"))}
      >
        <span className="font-bold">B</span>
      </ToolbarBtn>
      <ToolbarBtn
        title="Italic (Cmd/Ctrl+I)"
        ariaLabel="Italic"
        onClick={() => runAction((ta) => wrapSelection(ta, "*", "*", "italic"))}
      >
        <span className="italic">I</span>
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn
        title="Bullet list"
        ariaLabel="Bullet list"
        onClick={() => runAction((ta) => prefixLines(ta, "- "))}
      >
        <Icon name="list" size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Numbered list"
        ariaLabel="Numbered list"
        onClick={() => runAction((ta) => prefixLines(ta, "1. "))}
      >
        <Icon name="list-ordered" size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Task list"
        ariaLabel="Task list"
        onClick={() => runAction((ta) => prefixLines(ta, "- [ ] "))}
      >
        <Icon name="list-checks" size={14} />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn
        title="Link (Cmd/Ctrl+K)"
        ariaLabel="Link"
        onClick={() => runAction((ta) => insertLink(ta))}
      >
        <Icon name="link" size={12} />
      </ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({
  title,
  ariaLabel,
  onClick,
  children,
}: {
  title: string;
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={[
        "inline-flex items-center justify-center",
        "min-w-[28px] h-7 px-2 rounded",
        "font-sans text-xs text-ink-700 hover:bg-paper-200 hover:text-ink-900",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="w-px h-5 bg-paper-300 mx-0.5"
    />
  );
}

/* ─────────────────────────────────────────────────────────────
 *  Text helpers — pure, no React. Each returns a TextareaPatch
 *  describing the new buffer + where to leave the selection.
 *  Exported individually below so they can be unit-tested.
 * ─────────────────────────────────────────────────────────── */

export interface TextareaPatch {
  value: string;
  selStart: number;
  selEnd: number;
}

/**
 * Wrap the current selection with `before` ... `after`. When there's
 * no selection, insert a placeholder so the user has something to
 * type over — and select the placeholder so the next keystroke
 * replaces it cleanly.
 */
export function wrapSelection(
  ta: { selectionStart: number; selectionEnd: number; value: string },
  before: string,
  after: string,
  placeholder: string,
): TextareaPatch {
  const { selectionStart, selectionEnd, value } = ta;
  const hadSelection = selectionEnd > selectionStart;
  const selected = hadSelection
    ? value.slice(selectionStart, selectionEnd)
    : placeholder;
  const insertText = before + selected + after;
  const newValue =
    value.slice(0, selectionStart) + insertText + value.slice(selectionEnd);
  return {
    value: newValue,
    selStart: selectionStart + before.length,
    selEnd: selectionStart + before.length + selected.length,
  };
}

/**
 * Prefix every line touched by the selection with `prefix`. For a
 * collapsed caret on an empty line — including the empty buffer
 * case — the prefix IS inserted so the user has somewhere to start
 * typing. Empty *intermediate* lines inside a multi-line selection
 * are skipped so a paragraph break in a multi-paragraph selection
 * doesn't get a stray bullet between groups.
 */
export function prefixLines(
  ta: { selectionStart: number; selectionEnd: number; value: string },
  prefix: string,
): TextareaPatch {
  const { selectionStart, selectionEnd, value } = ta;
  // Walk back to the start of the line containing selectionStart.
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  // Walk forward to the end of the line containing selectionEnd.
  // For a collapsed caret AT a newline, indexOf from selectionEnd
  // still finds the right boundary.
  const nextNl = value.indexOf("\n", selectionEnd);
  const lineEnd = nextNl === -1 ? value.length : nextNl;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const isMultiLine = lines.length > 1;
  const modified = lines
    .map((line) => {
      // Only skip empty lines on multi-line selections. A solo empty
      // line means the user is starting fresh — they need the prefix.
      if (isMultiLine && line.length === 0) return line;
      return prefix + line;
    })
    .join("\n");
  const newValue =
    value.slice(0, lineStart) + modified + value.slice(lineEnd);
  return {
    value: newValue,
    selStart: lineStart,
    selEnd: lineStart + modified.length,
  };
}

/**
 * Insert a `[label](url)` link. If the user had selected text, that
 * text becomes the label and the cursor lands inside the `url`
 * placeholder ready for typing. If no selection, both label and url
 * are placeholders and the label is selected first so it's the
 * primary edit target.
 */
export function insertLink(ta: {
  selectionStart: number;
  selectionEnd: number;
  value: string;
}): TextareaPatch {
  const { selectionStart, selectionEnd, value } = ta;
  const hadSelection = selectionEnd > selectionStart;
  const label = hadSelection
    ? value.slice(selectionStart, selectionEnd)
    : "link text";
  const url = "url";
  const insertText = `[${label}](${url})`;
  const newValue =
    value.slice(0, selectionStart) + insertText + value.slice(selectionEnd);
  // After selection, we want the user to land where they'll type
  // next: when they highlighted text, the URL is what's missing;
  // when they didn't, the label is the primary target.
  if (hadSelection) {
    const urlStart = selectionStart + 1 + label.length + 2; // `[${label}](`
    return {
      value: newValue,
      selStart: urlStart,
      selEnd: urlStart + url.length,
    };
  }
  const labelStart = selectionStart + 1; // skip `[`
  return {
    value: newValue,
    selStart: labelStart,
    selEnd: labelStart + label.length,
  };
}
