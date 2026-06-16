import { useId, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "../lib/useAuth";
import { readKeepAwake, writeKeepAwake } from "../lib/keepAwake";
import { Icon } from "../components/ui";
import type { IconName } from "../components/ui";

/**
 * Account / settings hub — the destination for the mobile tab bar's
 * "You" tab per the design system mobile shell spec.
 *
 * Layout mirrors `ui_kits/mobile/screens.jsx`'s MYouSettings:
 *   - profile row (avatar + name + email)
 *   - grouped settings sections (Library / Sharing)
 *   - sign-out row in its own danger-tinted section at the bottom
 *
 * Reachable on every breakpoint via the URL, but it only earns its
 * keep on mobile — desktop users navigate the same destinations from
 * the sidebar. Harmless to render on desktop; we don't hide it.
 */
export function Account() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [keepAwake, setKeepAwake] = useState(() => readKeepAwake());

  // Initial letter for the avatar circle — first name → first email
  // letter → "?" fallback so we never render an empty disc.
  const initial = useMemo(() => {
    const name = user?.displayName ?? user?.email ?? "";
    return name.trim().charAt(0).toUpperCase() || "?";
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  function handleSignOut() {
    void signOut();
    // Land on home (which will redirect to SignInScreen post-signout).
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto max-w-[640px] px-6 py-8 lg:px-10 lg:py-10">
      <h1 className="font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-6">
        You
      </h1>

      {/* Profile card */}
      <section className="mb-6 flex items-center gap-3.5 rounded-lg bg-white px-4 py-4 shadow-sm border border-[var(--border-faint)]">
        <div
          aria-hidden="true"
          className="w-12 h-12 rounded-full bg-olive-300 text-olive-900 flex items-center justify-center font-display font-semibold text-xl shrink-0"
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-sans font-semibold text-md text-ink-900 truncate">
            {user.displayName ?? "Signed in"}
          </div>
          <div className="font-sans text-sm text-ink-500 truncate">
            {user.email}
          </div>
        </div>
      </section>

      <SettingsSection label="Library">
        <SettingsRow
          to="/chapters"
          icon="book-open"
          iconBg="bg-tomato-100"
          iconFg="text-tomato-700"
          label="Manage chapters"
        />
        <SettingsRow
          to="/tags"
          icon="bookmark"
          iconBg="bg-plum-100"
          iconFg="text-plum-700"
          label="Manage tags"
        />
        <SettingsRow
          to="/meal-plans"
          icon="utensils"
          iconBg="bg-saffron-100"
          iconFg="text-saffron-700"
          label="Meal plans"
        />
      </SettingsSection>

      <SettingsSection label="Sharing">
        <SettingsRow
          to="/settings/sharing"
          icon="users"
          iconBg="bg-olive-100"
          iconFg="text-olive-700"
          label="Sharing settings"
        />
      </SettingsSection>

      <SettingsSection label="Display">
        <SettingsToggleRow
          icon="sun"
          iconBg="bg-saffron-100"
          iconFg="text-saffron-700"
          label="Keep screen awake while cooking"
          checked={keepAwake}
          onChange={(next) => {
            setKeepAwake(next);
            writeKeepAwake(next);
          }}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          icon="log-out"
          iconBg="bg-tomato-50"
          iconFg="text-tomato-700"
          label="Sign out"
          labelClass="text-tomato-700 font-semibold"
          onClick={handleSignOut}
          chevron={false}
        />
      </SettingsSection>
    </div>
  );
}

/**
 * Grouped settings section — bordered card with an optional uppercase
 * eyebrow label above. iOS-style: ink-100 separators between rows,
 * rounded-lg corners on the outer card. Multiple sections stack with
 * `mb-6` spacing.
 */
function SettingsSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {label && (
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500 px-1 mb-2">
          {label}
        </div>
      )}
      <div className="bg-white rounded-lg border border-[var(--border-faint)] overflow-hidden divide-y divide-[var(--border-faint)]">
        {children}
      </div>
    </div>
  );
}

interface SettingsRowProps {
  icon: IconName;
  iconBg: string;
  iconFg: string;
  label: string;
  /** When set, the whole row becomes a router Link to this path. */
  to?: string;
  /** When set, the row is a button that fires this on click. */
  onClick?: () => void;
  /** Override the default label color/weight (e.g. for the destructive Sign out row). */
  labelClass?: string;
  /** Trailing chevron — defaults to true. Sign out has no destination, so it sets false. */
  chevron?: boolean;
}

function SettingsRow({
  icon,
  iconBg,
  iconFg,
  label,
  to,
  onClick,
  labelClass = "text-ink-900",
  chevron = true,
}: SettingsRowProps) {
  const inner = (
    <>
      <div
        aria-hidden="true"
        className={[
          "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
          iconBg,
          iconFg,
        ].join(" ")}
      >
        <Icon name={icon} size={16} />
      </div>
      <span
        className={[
          "flex-1 min-w-0 font-sans text-md truncate text-left",
          labelClass,
        ].join(" ")}
      >
        {label}
      </span>
      {chevron && (
        <span className="text-ink-300 shrink-0">
          <Icon name="chevron-right" size={16} />
        </span>
      )}
    </>
  );

  // Common visual treatment shared by the Link and button variants.
  const rowClasses =
    "flex items-center gap-3 px-4 py-3 min-h-[52px] no-underline hover:bg-paper-100 transition-colors duration-100 w-full text-left";

  if (to) {
    return (
      <Link to={to} className={rowClasses}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={rowClasses}>
      {inner}
    </button>
  );
}

function SettingsToggleRow({
  icon,
  iconBg,
  iconFg,
  label,
  checked,
  onChange,
}: {
  icon: IconName;
  iconBg: string;
  iconFg: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 px-4 py-3 min-h-[52px] cursor-pointer hover:bg-paper-100 transition-colors duration-100 w-full"
    >
      <div
        aria-hidden="true"
        className={["w-8 h-8 rounded-md flex items-center justify-center shrink-0", iconBg, iconFg].join(" ")}
      >
        <Icon name={icon} size={16} />
      </div>
      <span className="flex-1 min-w-0 font-sans text-md truncate text-ink-900">
        {label}
      </span>
      <div className="relative shrink-0" aria-hidden="true">
        <div
          className={[
            "w-10 h-6 rounded-full transition-colors duration-200",
            checked ? "bg-tomato-500" : "bg-ink-300",
          ].join(" ")}
        />
        <div
          className={[
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </div>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
