import { useCallback, useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useToast } from "../lib/useToast";
import { trackEvent } from "../lib/analytics";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { RecipeForm } from "../components/RecipeForm";
import { Button, ConfirmDialog } from "../components/ui";

export function NewRecipe() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [isDirty, setIsDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  // Stable callback so RecipeForm's onDirtyChange effect doesn't churn.
  const handleDirtyChange = useCallback((d: boolean) => setIsDirty(d), []);

  function navIfClean(action: () => void) {
    if (isDirty) {
      setPendingNav(() => action);
    } else {
      action();
    }
  }

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function onSubmit(input: RecipeInput) {
    const docRef = await addDoc(collection(db, "recipes"), {
      ...input,
      ownerId: user!.uid,
      sharedWith: [],
      // Denormalized {uid, email}[] for the Share dialog. Kept in sync
      // with sharedWith by the shareRecipe / unshareRecipe Cloud Functions.
      sharedWithDetails: [],
      searchTokens: buildSearchTokens(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    trackEvent("recipe_created", {
      source: "manual",
      has_source: input.source !== undefined,
      ingredient_sections: input.ingredients.length,
    });
    toast.show(`Saved "${input.title}"`);
    // replace so the browser Back button skips the form and goes to
    // wherever the user came from (typically the list).
    navigate(`/recipes/${docRef.id}`, { replace: true });
  }

  // Pop the form off the history stack instead of pushing a fresh "/"
  // entry. Pushing would leave /recipes/new in the back stack — one
  // browser-back from home would shove the user back into the form.
  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
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
        New recipe
      </h1>
      <RecipeForm
        submitLabel="Save recipe"
        onSubmit={onSubmit}
        onCancel={() => navIfClean(goBack)}
        onDirtyChange={handleDirtyChange}
      />

      <ConfirmDialog
        open={pendingNav !== null}
        title="Discard recipe?"
        message="You haven't saved this recipe yet. Leave without saving?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setPendingNav(null)}
        onConfirm={() => {
          const go = pendingNav;
          setPendingNav(null);
          // Clear the local dirty flag so the navigation doesn't re-trigger
          // the dialog from a quick double-Back race.
          setIsDirty(false);
          go?.();
        }}
      />
    </div>
  );
}
