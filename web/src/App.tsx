import { Route, Routes } from "react-router";
import { useAuth } from "./lib/useAuth";
import { Layout } from "./components/Layout";
import { SignInScreen } from "./components/SignInScreen";
import { Home } from "./routes/Home";
import { Import } from "./routes/Import";
import { NewRecipe } from "./routes/NewRecipe";
import { EditRecipe } from "./routes/EditRecipe";
import { RecipeDetail } from "./routes/RecipeDetail";
import { Chapters } from "./routes/Chapters";
import { Sharing } from "./routes/Sharing";

/**
 * Top-level routing + auth gate.
 *
 * Unauthenticated users hit <SignInScreen /> regardless of path. Once
 * signed in, every route renders inside <Layout> (the sidebar shell)
 * via React Router's nested-route + <Outlet /> pattern.
 *
 * The route table below sits directly under the Layout — there is no
 * "shell vs no-shell" distinction post-auth. Every screen lives in
 * the cookbook shell, even if it's a single recipe detail view.
 */
export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-100">
        <p className="text-ink-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/recipes/new" element={<NewRecipe />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/recipes/:id/edit" element={<EditRecipe />} />
        <Route path="/import" element={<Import />} />
        <Route path="/chapters" element={<Chapters />} />
        <Route path="/settings/sharing" element={<Sharing />} />
      </Route>
    </Routes>
  );
}
