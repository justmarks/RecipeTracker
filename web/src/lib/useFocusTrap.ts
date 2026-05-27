import { useEffect } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Trap keyboard focus inside `containerRef` while `active` is true.
 *
 * - Moves focus to the first focusable element on activate.
 * - Cycles Tab / Shift+Tab between the first and last focusable.
 * - Restores focus to whatever was active before activation on deactivate.
 *
 * Use for non-modal overlays (e.g. side drawers) where native <dialog>'s
 * centered positioning would fight the layout. For real modal dialogs,
 * <dialog> + showModal() handles all this natively.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) focusables[0].focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const fs = container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (fs.length === 0) {
        e.preventDefault();
        return;
      }
      const first = fs[0];
      const last = fs[fs.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // Restore focus only if the previously-focused element is still in the DOM.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
