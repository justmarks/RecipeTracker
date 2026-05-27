import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { RecipeForm } from "../components/RecipeForm";
import { Button } from "../components/ui";

export function EditRecipe() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<RecipeInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
        <Button
          variant="ghost"
          icon="arrow-left"
          onClick={() => navigate("/")}
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
    await updateDoc(doc(db, "recipes", id!), {
      ...input,
      searchTokens: buildSearchTokens(input),
      updatedAt: serverTimestamp(),
    });
    navigate(`/recipes/${id}`);
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={() => navigate(`/recipes/${id}`)}
        className="px-0 mb-4"
      >
        Back
      </Button>
      <h1 className="font-display text-[32px] sm:text-[38px] font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-5">
        Edit recipe
      </h1>
      <RecipeForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        onCancel={() => navigate(`/recipes/${id}`)}
      />
    </div>
  );
}
