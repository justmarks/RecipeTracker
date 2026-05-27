import { useNavigate, Navigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { buildSearchTokens } from "shared";
import type { RecipeInput } from "shared";
import { RecipeForm } from "../components/RecipeForm";
import { Button } from "../components/ui";

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
    <div className="mx-auto max-w-[720px] px-6 py-8 lg:px-10 lg:py-10">
      <Button
        variant="ghost"
        icon="arrow-left"
        onClick={() => navigate("/")}
        className="px-0 mb-4"
      >
        Back
      </Button>
      <h1 className="font-display text-[32px] sm:text-[38px] font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 m-0 mb-5">
        New recipe
      </h1>
      <RecipeForm
        submitLabel="Save recipe"
        onSubmit={onSubmit}
        onCancel={() => navigate("/")}
      />
    </div>
  );
}
