import { useState } from "react";
import { Icon, Textarea } from "./ui";
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
 * raw textarea; "Preview" renders the live document with interactive
 * task checkboxes. Switching tabs preserves the buffer either way —
 * we never re-parse, just re-render.
 *
 * Defaults to Preview when the buffer already has content (the user
 * is most often returning to check off items they previously wrote);
 * defaults to Write when the buffer is empty (no rendered view
 * to look at yet).
 *
 * Clicking a rendered checkbox in Preview mode rewrites the source
 * string via toggleTaskInSource, which propagates through onChange to
 * the parent's debounced save effect — same path as text edits.
 */
export function PrepNotesEditor({ value, onChange }: PrepNotesEditorProps) {
  const [mode, setMode] = useState<Mode>(value.trim() ? "preview" : "write");

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
          <Textarea
            mono
            rows={8}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={PLACEHOLDER}
            className="print:hidden"
          />
          <MarkdownHint />
        </>
      ) : value.trim() === "" ? (
        <p className="font-sans text-sm text-ink-500 m-0">
          Nothing here yet. Switch to <strong>Write</strong> and start
          typing — markdown headers, bullets, numbered lists, task
          checkboxes (<code className="font-mono">- [ ]</code>), bold,
          italic, and links all render here.
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

## Day of
- [ ] Roast turkey at noon
- [ ] Reheat sides
- [ ] Set the table

You can use **bold**, *italic*, and [links](https://example.com).`;

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

function MarkdownHint() {
  return (
    <p className="mt-1.5 font-sans text-xs text-ink-500 flex flex-wrap items-center gap-x-2 gap-y-1 print:hidden">
      <span className="inline-flex items-center gap-1">
        <Icon name="sparkles" size={11} /> Markdown:
      </span>
      <span>
        <code className="font-mono">## Heading</code>
      </span>
      <span>
        <code className="font-mono">- bullet</code>
      </span>
      <span>
        <code className="font-mono">1. number</code>
      </span>
      <span>
        <code className="font-mono">- [ ] task</code>
      </span>
      <span>
        <code className="font-mono">**bold**</code>
      </span>
      <span>
        <code className="font-mono">*italic*</code>
      </span>
      <span>
        <code className="font-mono">[link](url)</code>
      </span>
    </p>
  );
}
