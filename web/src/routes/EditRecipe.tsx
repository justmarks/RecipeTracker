import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { RecipeForm } from "../components/RecipeForm";

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
        // Cast to RecipeInput shape. Optional fields may be absent in
        // Firestore — RecipeForm handles undefined values.
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
      <main className="mx-auto max-w-2xl p-6">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <p className="mt-4 text-red-600">{loadError}</p>
      </main>
    );
  }
  if (!initial || !id) return null;

  // Note: only the editable fields are sent. ownerId, sharedWith, and
  // createdAt are preserved by updateDoc's merge semantics, which keeps
  // the security rule's "ownership immutable" check satisfied.
  async function onSubmit(input: RecipeInput) {
    await updateDoc(doc(db, "recipes", id!), {
      ...input,
      searchTokens: buildSearchTokens(input),
      updatedAt: serverTimestamp(),
    });
    navigate(`/recipes/${id}`);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to={`/recipes/${id}`} className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Edit recipe</h1>
      <RecipeForm initial={initial} submitLabel="Save changes" onSubmit={onSubmit} />
    </main>
  );
}
