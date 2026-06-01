import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Render in JetBrains Mono. Use for ingredient lists, raw markdown, code. */
  mono?: boolean;
}

/**
 * Multi-line text input. Same paper-and-tomato styling as <Input>.
 * Pass `mono` to render in JetBrains Mono — appropriate for raw
 * markdown, ingredient lists where alignment matters, and any
 * paste-target that benefits from monospaced clarity.
 */
export function Textarea({
  mono = false,
  className = "",
  rows = 4,
  ...rest
}: TextareaProps) {
  const classes = [
    "w-full text-ink-900 bg-white",
    mono ? "font-mono text-sm" : "font-sans text-sm",
    "border border-paper-400 rounded-md px-3 py-2.5",
    "outline-none resize-y transition-colors duration-100 ease-out",
    "focus:border-tomato-500 focus:shadow-[var(--shadow-focus)]",
    "placeholder:text-ink-300",
    "disabled:bg-paper-200 disabled:text-ink-500 disabled:cursor-not-allowed",
    className,
  ].join(" ");

  return <textarea rows={rows} className={classes} {...rest} />;
}
