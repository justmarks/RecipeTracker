import { useNavigate, Navigate, Link } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { RecipeForm } from "../components/RecipeForm";

export function NewRecipe() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  async function onSubmit(input: RecipeInput) {
    const docRef = await addDoc(collection(db, "recipes"), {
      ...input,
      ownerId: user!.uid,
      sharedWith: [],
      searchTokens: buildSearchTokens(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigate(`/recipes/${docRef.id}`);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">New recipe</h1>
      <RecipeForm submitLabel="Save recipe" onSubmit={onSubmit} />
    </main>
  );
}
