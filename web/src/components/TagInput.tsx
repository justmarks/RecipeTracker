import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Tag, tagToneFor } from "./ui";
import type { TagPalette } from "../lib/tags";
import { normalizeTag } from "../lib/tags";

interface TagInputProps {
  /** Current tag values, lowercase. */
  value: string[];
  onChange: (next: string[]) => void;
  /** All tag names the user already knows about (palette + recipe-derived). */
  suggestions: string[];
  /** Palette so chips render with the user's chosen colors. */
  palette?: TagPalette;
  placeholder?: string;
}

/**
 * Chip-based tag input with autocomplete. Renders selected tags as
 * removable chips followed by a typeable input. As the user types, a
 * dropdown surfaces matching known tags they haven't selected yet, plus
 * an explicit "Create" row when the typed value doesn't match anything.
 *
 * Keyboard contract:
 *   Enter         → add highlighted suggestion (or the typed text)
 *   Comma / Tab   → add the typed text
 *   ArrowDown/Up  → move highlight in the dropdown
 *   Escape        → close the dropdown without adding
 *   Backspace     → on an empty input, removes the last chip
 *
 * Values are normalized (lowercase + collapsed whitespace) on the way
 * in so the parent only ever sees clean, deduped tag strings.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  palette,
  placeholder,
}: TagInputProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => new Set(value), [value]);
  const query = normalizeTag(text);

  const filtered = useMemo(() => {
    const out: string[] = [];
    for (const s of suggestions) {
      const n = normalizeTag(s);
      if (!n || selected.has(n)) continue;
      if (!query || n.includes(query)) out.push(n);
    }
    // Stable alphabetical order so the dropdown doesn't reshuffle on
    // every keystroke beyond what the filter requires. The dropdown
    // itself caps height via `max-h-60 overflow-y-auto`, so the
    // scrollbar takes care of long suggestion lists — no slice cap.
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [suggestions, selected, query]);

  // Whether the typed query is a brand-new tag worth offering as
  // "Create". Only when it doesn't already match an existing tag the
  // user hasn't selected — otherwise the existing-match row covers it.
  const canCreate =
    query.length > 0 && !selected.has(query) && !filtered.includes(query);

  // Keep highlight in range — when the suggestion list shrinks (more
  // typing) the previously-highlighted index may now be out of bounds.
  useEffect(() => {
    setHighlight((h) =>
      Math.min(h, Math.max(0, filtered.length + (canCreate ? 1 : 0) - 1)),
    );
  }, [filtered.length, canCreate]);

  // Close the dropdown when focus leaves the whole control. We listen
  // on focusin at the document level rather than onBlur of the input
  // because clicking a suggestion row briefly moves focus out of the
  // input but stays inside the container — onBlur would fire too early
  // and the click would never land.
  useEffect(() => {
    function onDocFocus(e: FocusEvent) {
      const c = containerRef.current;
      if (!c) return;
      if (!c.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("focusin", onDocFocus);
    return () => document.removeEventListener("focusin", onDocFocus);
  }, []);

  function addTag(raw: string) {
    const t = normalizeTag(raw);
    if (!t) return;
    if (selected.has(t)) {
      setText("");
      return;
    }
    onChange([...value, t]);
    setText("");
    setHighlight(0);
    // Keep the input focused so the user can rapid-fire add multiple.
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag));
    inputRef.current?.focus();
  }

  function commitHighlight() {
    if (highlight < filtered.length) {
      addTag(filtered[highlight]);
    } else if (canCreate) {
      addTag(query);
    } else if (query) {
      // Fallback for when filtered is empty AND canCreate is false
      // (selected already includes the query) — just clear the text.
      setText("");
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = filtered.length + (canCreate ? 1 : 0);
    if (e.key === "Enter") {
      e.preventDefault();
      commitHighlight();
    } else if (e.key === "," || e.key === "Tab") {
      if (!query) return; // Tab with empty input should still tab out.
      e.preventDefault();
      // Comma/Tab always commit the typed text verbatim — don't pick
      // the highlighted suggestion. Users typing a new tag and hitting
      // Tab expect their literal text, not whatever happens to be
      // hovered in the dropdown.
      addTag(query);
    } else if (e.key === "ArrowDown") {
      if (total === 0) return;
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % total);
    } else if (e.key === "ArrowUp") {
      if (total === 0) return;
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + total) % total);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={[
          "min-h-[42px] w-full",
          "flex flex-wrap items-center gap-1.5",
          "bg-white border border-paper-400 rounded-md px-2 py-1.5",
          "transition-colors duration-100 ease-out",
          "focus-within:border-tomato-500 focus-within:shadow-[var(--shadow-focus)]",
        ].join(" ")}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t) => {
          const tone = tagToneFor(t, palette);
          return (
            <Chip key={t} tone={tone} onRemove={() => removeTag(t)}>
              {t}
            </Chip>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? (placeholder ?? "") : ""}
          className="flex-1 min-w-[80px] bg-transparent border-0 outline-none font-sans text-sm text-ink-900 placeholder:text-ink-300 py-1"
        />
      </div>

      {open && (filtered.length > 0 || canCreate) && (
        <ul
          role="listbox"
          className={[
            "absolute z-20 left-0 right-0 mt-1",
            "bg-white border border-[var(--border-faint)] rounded-md shadow-md",
            "max-h-60 overflow-y-auto py-1 list-none m-0",
          ].join(" ")}
        >
          {filtered.map((s, i) => {
            const tone = tagToneFor(s, palette);
            const active = i === highlight;
            return (
              <li
                key={s}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // mousedown (not click) so the input doesn't lose
                  // focus first — focus loss would close the dropdown
                  // before the click registers.
                  e.preventDefault();
                  addTag(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={[
                  "px-2.5 py-1.5 cursor-pointer flex items-center gap-2",
                  active ? "bg-paper-100" : "bg-transparent",
                ].join(" ")}
              >
                <Tag tone={tone}>{s}</Tag>
              </li>
            );
          })}
          {canCreate && (
            <li
              role="option"
              aria-selected={highlight === filtered.length}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(query);
              }}
              onMouseEnter={() => setHighlight(filtered.length)}
              className={[
                "px-2.5 py-1.5 cursor-pointer flex items-center gap-2",
                "border-t border-[var(--border-faint)]",
                highlight === filtered.length
                  ? "bg-paper-100"
                  : "bg-transparent",
              ].join(" ")}
            >
              <Icon name="plus" size={14} className="text-tomato-600" />
              <span className="font-sans text-sm text-ink-700">
                Create{" "}
                <span className="font-semibold text-ink-900">
                  &ldquo;{query}&rdquo;
                </span>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

interface ChipProps {
  tone: React.ComponentProps<typeof Tag>["tone"];
  children: React.ReactNode;
  onRemove: () => void;
}

/**
 * Selected-tag chip — a Tag with a trailing × button. Wraps the Tag
 * primitive instead of restyling so colors stay in lockstep with the
 * library palette.
 */
function Chip({ tone, children, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <Tag tone={tone}>
        <span className="inline-flex items-center gap-1.5">
          {children}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove tag ${children}`}
            className="inline-flex items-center justify-center rounded-sm hover:bg-black/10 -mr-0.5"
          >
            <Icon name="x" size={12} />
          </button>
        </span>
      </Tag>
    </span>
  );
}
