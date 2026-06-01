import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface ToastProps {
  children: ReactNode;
  visible: boolean;
}

/**
 * Bottom-center confirmation toast. Slides up + fades in over 200ms,
 * out by reversing. The only "playful" motion in the system per the
 * design guide — everything else is instant.
 *
 * Stateless: the caller controls `visible`. Pair with a useEffect +
 * setTimeout for auto-dismiss (typical 2.5–3s).
 *
 * Always carries a check icon (olive-300) for the success / saved
 * affordance. For error/info toasts, build a different component —
 * this one is the green-check pattern.
 */
export function Toast({ children, visible }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        // Lifted above the mobile tab bar (`bottom-24` ≈ 96px clears
        // the ~80px tab bar + iOS home indicator); falls back to the
        // original `bottom-8` (32px) on desktop where no tab bar
        // exists.
        "fixed bottom-24 lg:bottom-8 left-1/2 z-50 inline-flex items-center gap-2.5",
        "rounded-lg bg-ink-900 px-4 py-3 text-paper-100 shadow-lg",
        "font-sans text-sm pointer-events-none",
      ].join(" ")}
      style={{
        transform: visible ? "translate(-50%, 0)" : "translate(-50%, 20px)",
        opacity: visible ? 1 : 0,
        transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <span className="text-olive-300">
        <Icon name="check" size={16} />
      </span>
      {children}
    </div>
  );
}
