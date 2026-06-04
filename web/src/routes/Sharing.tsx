import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { DocumentData, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useToast } from "../lib/useToast";
import {
  callGrantAutoShare,
  callRevokeAutoShare,
} from "../lib/sharing";
import { trackEvent } from "../lib/analytics";
import {
  Button,
  ConfirmDialog,
  Eyebrow,
  Icon,
  Input,
} from "../components/ui";

type AutoShareRow = {
  id: string;
  granteeUid: string;
  granteeEmail: string;
  createdAt?: Timestamp;
};

type IncomingShareRow = {
  id: string;
  ownerId: string;
  // grantAutoShare denormalizes the owner's email onto each autoShare
  // doc so the grantee can see who shared with them without a separate
  // user lookup. Optional because docs created before that change exist
  // without the field (re-grant repopulates it).
  ownerEmail?: string;
  createdAt?: Timestamp;
};

/**
 * Auto-share settings — manage blanket access grants for family members.
 *
 * Two lists:
 *  - "People who can see all your recipes" — autoShares where ownerId == me
 *  - "People who shared everything with you" — autoShares where granteeUid == me
 *
 * Both lists are live (onSnapshot). Granting is callable-driven so we can
 * resolve email → uid server-side and reject self-grants / duplicates
 * with a clear error message.
 */
export function Sharing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [outgoing, setOutgoing] = useState<AutoShareRow[]>([]);
  const [incoming, setIncoming] = useState<IncomingShareRow[]>([]);

  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmRevoke, setConfirmRevoke] = useState<AutoShareRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Live subscriptions for both directions.
  useEffect(() => {
    if (!user) return;
    const out = onSnapshot(
      query(
        collection(db, "autoShares"),
        where("ownerId", "==", user.uid),
      ),
      (snap) => {
        setOutgoing(
          snap.docs.map((d) => {
            const data = d.data() as DocumentData;
            return {
              id: d.id,
              granteeUid: data.granteeUid,
              granteeEmail: data.granteeEmail,
              createdAt: data.createdAt as Timestamp | undefined,
            };
          }),
        );
      },
      (err) => console.error("outgoing autoShares:", err),
    );
    const inc = onSnapshot(
      query(
        collection(db, "autoShares"),
        where("granteeUid", "==", user.uid),
      ),
      (snap) => {
        setIncoming(
          snap.docs.map((d) => {
            const data = d.data() as DocumentData;
            return {
              id: d.id,
              ownerId: data.ownerId,
              ownerEmail: data.ownerEmail as string | undefined,
              createdAt: data.createdAt as Timestamp | undefined,
            };
          }),
        );
      },
      (err) => console.error("incoming autoShares:", err),
    );
    return () => {
      out();
      inc();
    };
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  // Smart back — return to whoever sent the user here (Account on
  // mobile, anywhere on desktop) instead of hardcoding home. Falls
  // back to home for direct URL loads with no history to pop.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  async function handleGrant() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setGranting(true);
    try {
      const result = await callGrantAutoShare({ granteeEmail: trimmed });
      if (result.data.alreadyGranted) {
        toast.show(`${result.data.grantee.email} already had access.`);
      } else {
        trackEvent("autoshare_granted");
        toast.show(`Shared your cookbook with ${result.data.grantee.email}.`);
      }
      setEmail("");
    } catch (err) {
      console.error("grantAutoShare:", err);
      setError(err instanceof Error ? err.message : "Could not share.");
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke() {
    if (!confirmRevoke) return;
    const row = confirmRevoke;
    setRevoking(true);
    try {
      await callRevokeAutoShare({ granteeUid: row.granteeUid });
      toast.show(`Removed ${row.granteeEmail}'s access.`);
      setConfirmRevoke(null);
    } catch (err) {
      console.error("revokeAutoShare:", err);
      setError(err instanceof Error ? err.message : "Could not revoke.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={goBack}
        className="px-0 mb-4"
      >
        Back
      </Button>

      <h1 className="font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-2">
        Sharing
      </h1>
      <p className="font-sans text-sm text-ink-700 m-0 mb-7 max-w-[480px]">
        Auto-share gives someone access to every recipe and meal plan in
        your cookbook — current and future. For one-off shares, use the
        Share button on an individual recipe or meal plan.
      </p>

      <section className="mb-8 bg-white rounded-lg px-6 py-5 shadow-sm border border-[var(--border-faint)]">
        <Eyebrow className="flex items-center gap-1.5 text-tomato-600 mb-3">
          <Icon name="users" size={12} />
          Share your cookbook
        </Eyebrow>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="family@example.com"
            disabled={granting}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && email.trim() && !granting) {
                e.preventDefault();
                handleGrant();
              }
            }}
          />
          <Button
            type="button"
            variant="primary"
            icon="share-2"
            onClick={handleGrant}
            disabled={granting || !email.trim()}
          >
            {granting ? "Sharing…" : "Share"}
          </Button>
        </div>
        {error && (
          <p className="font-sans text-sm text-tomato-700 m-0 mt-2">
            {error}
          </p>
        )}
        <p className="font-sans text-xs text-ink-500 m-0 mt-2">
          They need to have signed in to MarksRecipeBook at least once.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3 pb-2 border-b border-paper-300">
          People who can see all your recipes and meal plans
          <span className="ml-2 font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
            {outgoing.length}
          </span>
        </h2>
        {outgoing.length === 0 ? (
          <p className="font-sans text-sm text-ink-500 m-0 py-2">
            You haven't auto-shared your cookbook with anyone yet.
          </p>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {outgoing.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-md bg-white border border-[var(--border-faint)]"
              >
                <span className="text-ink-500 shrink-0">
                  <Icon name="mail" size={14} />
                </span>
                <span className="flex-1 min-w-0 font-sans text-sm text-ink-900 truncate">
                  {row.granteeEmail}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmRevoke(row)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-medium text-ink-900 m-0 mb-3 pb-2 border-b border-paper-300">
          People who shared their cookbook with you
          <span className="ml-2 font-mono text-xs font-normal text-ink-300 [font-feature-settings:'tnum']">
            {incoming.length}
          </span>
        </h2>
        {incoming.length === 0 ? (
          <p className="font-sans text-sm text-ink-500 m-0 py-2">
            No one has shared their cookbook with you yet.
          </p>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {incoming.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-md bg-white border border-[var(--border-faint)]"
              >
                <span className="text-ink-500 shrink-0">
                  <Icon name="users" size={14} />
                </span>
                <span className="flex-1 min-w-0 font-sans text-sm text-ink-900 truncate">
                  {row.ownerEmail ?? (
                    <span className="text-ink-500 italic">
                      Shared with you (owner unknown — ask them to re-share to
                      populate their email)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmRevoke !== null}
        title="Remove access?"
        message={
          confirmRevoke
            ? `${confirmRevoke.granteeEmail} will no longer see your recipes or meal plans. Per-recipe and per-plan shares (the ones you set up individually) will stay.`
            : ""
        }
        confirmLabel={revoking ? "Removing…" : "Remove"}
        cancelLabel="Keep"
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={handleRevoke}
      />
    </div>
  );
}
