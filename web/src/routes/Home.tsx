import { Link } from "react-router";

export function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">RecipeTracker</h1>
      <p className="mt-2 text-slate-600">Your recipes will appear here.</p>
      <p className="mt-4 text-sm text-slate-500">
        Try the{" "}
        <Link to="/import?url=https://example.com/recipe&title=Test" className="text-blue-600 underline">
          import flow
        </Link>
        .
      </p>
    </main>
  );
}
