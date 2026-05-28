import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-5 py-3 gap-2",
};

const ICON_SIZE: Record<Size, number> = { sm: 14, md: 16, lg: 18 };

// Variant -> Tailwind class string. Hover/active states wired here, never
// via onMouseEnter — keeps SSR/static safe and touch-aware.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-tomato-500 text-white border border-transparent hover:bg-tomato-600 active:bg-tomato-700",
  secondary:
    "bg-transparent text-ink-900 border border-paper-400 hover:bg-paper-200 active:bg-paper-300",
  ghost:
    "bg-transparent text-tomato-600 border border-transparent hover:text-tomato-700 hover:bg-paper-200",
  danger:
    "bg-transparent text-tomato-700 border border-transparent hover:bg-tomato-50",
};

/**
 * Primary action button per the design system: rounded-md (8px),
 * Manrope 600, tomato primary, warm focus ring. Always opt the consumer
 * into a Lucide-style icon via `icon` / `iconRight` props rather than
 * passing arbitrary children — keeps icon sizing consistent.
 */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center font-sans font-semibold rounded-md",
    "leading-none whitespace-nowrap cursor-pointer",
    "transition-colors duration-100 ease-out",
    "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
    // 44px minimum tap target per the design system. The button's visual
    // padding still drives "sm vs md vs lg" appearance; this just lifts
    // the floor so a finger can hit any size cleanly on touch. Flex
    // centering keeps the label vertically centered in the extra space.
    "min-h-[44px]",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className,
  ].join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={ICON_SIZE[size]} />}
    </button>
  );
}
