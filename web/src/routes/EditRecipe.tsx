import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useToast } from "../lib/useToast";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { RecipeForm } from "../components/RecipeForm";
import { Button, ConfirmDialog } from "../components/ui";

export function EditRecipe() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [initial, setInitial] = useState<RecipeInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const handleDirtyChange = useCallback((d: boolean) => setIsDirty(d), []);

  useEffect(() => {
    if (!user || !id) return;
    getDoc(doc(db, "recipes", id))
      .then((snap) => {
        if (!snap.exists()) {
          setLoadError("Recipe not found.");
          return;
        }
        const data = snap.data();
        setInitial({
          title: data.title,
          source: data.source,
          ingredients: data.ingredients,
          instructions: data.instructions,
          notes: data.notes,
          yield: data.yield,
          prepTime: data.prepTime,
          cookTime: data.cookTime,
          totalTime: data.totalTime,
          category: data.category,
          tags: data.tags ?? [],
          photoUrl: data.photoUrl,
          rating: data.rating,
          lastMadeDate: data.lastMadeDate,
        });
      })
      .catch((err) => {
        console.error("Load recipe:", err);
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [user, id]);

  // Browser-level guard for refresh / close-tab / native back when dirty.
  // In-app navigation via the sidebar bypasses this; intercepting that
  // would need React Router's data router (useBlocker). Acceptable
  // limitation for now.
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function navIfClean(action: () => void) {
    if (isDirty) {
      setPendingNav(() => action);
    } else {
      action();
    }
  }

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
        <Button
          variant="ghost"
          icon="arrow-left"
          onClick={goBack}
          className="px-0 mb-4"
        >
          Back
        </Button>
        <p className="font-sans text-tomato-700">{loadError}</p>
      </div>
    );
  }
  if (!initial || !id) return null;

  // Only the editable fields are sent. ownerId, sharedWith, and createdAt
  // are preserved by Firestore's merge semantics, which keeps the security
  // rule's "ownership immutable" check satisfied.
  async function onSubmit(input: RecipeInput) {
    // Build the update payload. Optional fields the user cleared come
    // through as `undefined` — but ignoreUndefinedProperties on the
    // Firestore client *drops* those from the write rather than
    // deleting the existing value. We have to explicitly map cleared
    // optionals to deleteField() so they actually disappear from the
    // stored doc (otherwise "remove source URL" silently no-ops, etc).
    const updates: Record<string, unknown> = {
      ...input,
      searchTokens: buildSearchTokens(input),
      updatedAt: serverTimestamp(),
    };
    const optionalFields = [
      "source",
      "notes",
      "yield",
      "prepTime",
      "cookTime",
      "totalTime",
      "photoUrl",
      "rating",
      "lastMadeDate",
    ] as const;
    for (const field of optionalFields) {
      if (input[field] === undefined) {
        updates[field] = deleteField();
      }
    }
    await updateDoc(doc(db, "recipes", id!), updates);
    toast.show(`Saved changes to "${input.title}"`);
    // Pop the edit page off the history stack so the user returns to
    // wherever they came from (typically the recipe detail page).
    //
    // Previous behavior used `navigate(path, { replace: true })` here,
    // which REPLACED the edit entry with a detail entry — but the
    // user was already on /recipes/foo before clicking Edit, so the
    // history stack ended up [..., list, detail, detail-replaced].
    // First Back press then went from one /recipes/foo entry to the
    // other, looking like a no-op (same URL, no visible change), and
    // only the second press got back to the list. navigate(-1) avoids
    // creating that duplicate entry. The detail page uses a live
    // Firestore listener, so the just-saved edits show up immediately
    // when we land there.
    //
    // Fallback for the rare case where /edit was opened directly via
    // URL (no history to go back to): replace with detail so the user
    // lands somewhere sensible.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/recipes/${id}`, { replace: true });
    }
  }

  // Pop the edit entry off the history stack instead of pushing a new
  // detail entry on top. Pushing would mean clicking Back from the
  // detail page lands on /edit again — the user expects to walk back
  // toward the chapter / home they came from.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/recipes/${id}`);
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={() => navIfClean(goBack)}
        className="px-0 mb-4"
      >
        Back
      </Button>
      <h1 className="font-display text-2xl sm:text-3xl font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-5">
        Edit recipe
      </h1>
      <RecipeForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        onCancel={() => navIfClean(goBack)}
        onDirtyChange={handleDirtyChange}
      />

      <ConfirmDialog
        open={pendingNav !== null}
        title="Discard changes?"
        message="You have unsaved edits. Leave without saving?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setPendingNav(null)}
        onConfirm={() => {
          const go = pendingNav;
          setPendingNav(null);
          setIsDirty(false);
          go?.();
        }}
      />
    </div>
  );
}
