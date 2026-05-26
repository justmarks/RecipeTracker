import { Link } from "react-router";
import { useAuth } from "../lib/useAuth";

export function Home() {
  const { user, loading, signInWithGoogle, signInWithMicrosoft, signOut } = useAuth();

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">RecipeTracker</h1>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{user.email ?? user.displayName}</span>
            <button onClick={() => signOut()} className="text-blue-600 hover:underline">
              Sign out
            </button>
          </div>
        )}
      </header>

      {user ? (
        <p className="mt-6 text-slate-600">Your recipes will appear here.</p>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-slate-600">Sign in to start saving recipes.</p>
          <button
            onClick={() => signInWithGoogle()}
            className="block w-full max-w-xs rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Continue with Google
          </button>
          <button
            onClick={() => signInWithMicrosoft()}
            className="block w-full max-w-xs rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Continue with Microsoft
          </button>
        </div>
      )}

      <p className="mt-10 text-sm text-slate-500">
        Try the{" "}
        <Link
          to="/import?url=https://example.com/recipe&title=Test"
          className="text-blue-600 underline"
        >
          import flow
        </Link>
        .
      </p>
    </main>
  );
}
