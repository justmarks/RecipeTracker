import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { renderInlineMarkdown } from "../lib/inlineMarkdown";
import type { RecipeSource, Section } from "shared";

type StoredRecipe = {
  ownerId: string;
  title: string;
  source?: RecipeSource;
  ingredients: Section[];
  instructions: Section[];
  notes?: string;
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  category: string;
  tags: string[];
};

export function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    getDoc(doc(db, "recipes", id))
      .then((snap) => {
        if (snap.exists()) {
          setRecipe(snap.data() as DocumentData as StoredRecipe);
        } else {
          setError("Recipe not found.");
        }
      })
      .catch((err) => {
        console.error("Load recipe:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [user, id]);

  if (authLoading || loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <p className="mt-4 text-red-600">{error}</p>
      </main>
    );
  }
  if (!recipe) return null;

  const hasTimes = recipe.yield || recipe.prepTime || recipe.cookTime || recipe.totalTime;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">{recipe.title}</h1>
        {recipe.ownerId === user.uid && (
          <Link
            to={`/recipes/${id}/edit`}
            className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Edit
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {recipe.category}
        {recipe.tags.length > 0 && ` · ${recipe.tags.join(", ")}`}
      </p>

      {recipe.source && (
        <p className="mt-2 text-sm">
          {recipe.source.type === "url" ? (
            <a
              href={recipe.source.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-blue-600 underline"
            >
              {recipe.source.url}
            </a>
          ) : (
            <span className="text-slate-700">
              {recipe.source.title}
              {recipe.source.author && ` by ${recipe.source.author}`}
              {recipe.source.page && `, p. ${recipe.source.page}`}
            </span>
          )}
        </p>
      )}

      {hasTimes && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {recipe.yield && <Stat label="Yield" value={recipe.yield} />}
          {recipe.prepTime && <Stat label="Prep" value={recipe.prepTime} />}
          {recipe.cookTime && <Stat label="Cook" value={recipe.cookTime} />}
          {recipe.totalTime && <Stat label="Total" value={recipe.totalTime} />}
        </dl>
      )}

      <h2 className="mt-8 text-xl font-semibold">Ingredients</h2>
      {recipe.ingredients.map((section, i) => (
        <div key={i} className="mt-2">
          {section.heading && (
            <h3 className="text-sm font-semibold text-slate-700">{section.heading}</h3>
          )}
          <ul className="ml-5 list-disc">
            {section.items.map((item, j) => (
              <li key={j}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        </div>
      ))}

      <h2 className="mt-8 text-xl font-semibold">Instructions</h2>
      {recipe.instructions.map((section, i) => (
        <div key={i} className="mt-2">
          {section.heading && (
            <h3 className="text-sm font-semibold text-slate-700">{section.heading}</h3>
          )}
          <ol className="ml-5 list-decimal">
            {section.items.map((item, j) => (
              <li key={j} className="mt-1">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        </div>
      ))}

      {recipe.notes && (
        <>
          <h2 className="mt-8 text-xl font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-700">
            {renderInlineMarkdown(recipe.notes)}
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
