import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useChapters } from "../lib/categories";
import { Brand } from "./Brand";
import { Button, Eyebrow, Icon } from "./ui";

interface SidebarProps {
  /**
   * Called whenever a sidebar link is clicked. Used by the mobile
   * drawer to close itself after navigation. No-op on desktop.
   */
  onNavigate?: () => void;
  /** Show a close button (mobile drawer mode). */
  onClose?: () => void;
}

/**
 * The chapter sidebar — desktop nav shell. On lg+ it's fixed-width
 * (260px) and sticks to the viewport. Below lg it's rendered inside
 * a Layout drawer overlay (see Layout.tsx).
 *
 * Reads the active chapter from the URL `?chapter=<name>` query param
 * so the highlight survives reloads and the back button. Clicking
 * "All recipes" navigates to `/` without the param.
 */
export function Sidebar({ onNavigate, onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { chapters } = useChapters(user?.uid);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeChapter = params.get("chapter") ?? "";

  // Subscribe to recipe counts for the badge next to each chapter.
  // Lightweight — we only need the category strings.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "recipes"),
      where("ownerId", "==", user.uid),
    );
    return onSnapshot(
      q,
      (snap) => {
        const next: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const c = (d.data().category ?? "").toLowerCase();
          if (c) next[c] = (next[c] ?? 0) + 1;
        });
        setCounts(next);
        setTotalCount(snap.size);
      },
      (err) => console.error("Sidebar counts:", err),
    );
  }, [user]);

  const userInitial = useMemo(() => {
    const name = user?.displayName ?? user?.email ?? "";
    return name.trim().charAt(0).toUpperCase() || "?";
  }, [user]);

  function go(path: string) {
    navigate(path);
    onNavigate?.();
  }

  return (
    <aside
      className={[
        "w-[260px] shrink-0 h-screen sticky top-0",
        "bg-paper-50 border-r border-[var(--border-faint)]",
        "flex flex-col py-5",
      ].join(" ")}
    >
      {/* Brand + close (mobile) */}
      <div className="px-5 pb-4 flex items-center justify-between gap-2">
        <Link
          to="/"
          onClick={() => onNavigate?.()}
          className="min-w-0 no-underline"
        >
          <Brand />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1 text-ink-500 hover:text-ink-900"
          >
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      {/* Primary actions */}
      <div className="px-3 pb-3 flex flex-col gap-1.5">
        <Button
          variant="primary"
          icon="plus"
          onClick={() => go("/recipes/new")}
          className="w-full justify-start"
        >
          New recipe
        </Button>
        <Button
          variant="secondary"
          icon="sparkles"
          onClick={() => go("/import")}
          className="w-full justify-start"
        >
          Import from URL
        </Button>
      </div>

      {/* Chapters list */}
      <Eyebrow className="px-6 pt-4 pb-2">Chapters</Eyebrow>
      <nav className="flex-1 overflow-y-auto px-2">
        <ChapterButton
          name="All recipes"
          count={totalCount}
          active={activeChapter === ""}
          onClick={() => go("/")}
          italic
        />
        {chapters.map((c) => (
          <ChapterButton
            key={c}
            name={c}
            count={counts[c.toLowerCase()] ?? 0}
            active={activeChapter.toLowerCase() === c.toLowerCase()}
            onClick={() => go(`/?chapter=${encodeURIComponent(c)}`)}
          />
        ))}
      </nav>

      {/* Footer: manage chapters + user */}
      <div className="px-3 pt-3 border-t border-[var(--border-faint)]">
        <button
          type="button"
          onClick={() => go("/chapters")}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-transparent text-ink-700 hover:bg-paper-200 text-sm text-left transition-colors duration-100"
        >
          <Icon name="book-open" size={16} />
          Manage chapters
        </button>

        <div className="flex items-center gap-2.5 px-2.5 pt-2.5 pb-1">
          <div
            className="w-7 h-7 rounded-full bg-olive-300 text-olive-900 flex items-center justify-center font-display font-semibold text-[13px] shrink-0"
            aria-hidden="true"
          >
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ink-900 truncate">
              {user?.displayName ?? "Signed in"}
            </div>
            <div className="text-[11px] text-ink-500 truncate">
              {user?.email}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut();
              onNavigate?.();
            }}
            title="Sign out"
            aria-label="Sign out"
            className="text-ink-500 hover:text-ink-900 p-1 transition-colors duration-100"
          >
            <Icon name="log-out" size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

interface ChapterButtonProps {
  name: string;
  count: number;
  active: boolean;
  italic?: boolean;
  onClick: () => void;
}

function ChapterButton({
  name,
  count,
  active,
  italic = false,
  onClick,
}: ChapterButtonProps) {
  const base =
    "w-full flex items-center justify-between px-3.5 py-2 rounded-md text-sm transition-colors duration-100 mb-0.5";
  const state = active
    ? "bg-paper-200 text-ink-900 font-semibold"
    : "bg-transparent text-ink-700 font-medium hover:bg-paper-200";
  return (
    <button type="button" onClick={onClick} className={`${base} ${state}`}>
      <span
        className={italic ? "font-display italic text-[15px]" : "capitalize"}
      >
        {name}
      </span>
      <span className="font-mono text-[11px] text-ink-300 [font-feature-settings:'tnum']">
        {count}
      </span>
    </button>
  );
}
