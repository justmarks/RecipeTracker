import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";
import { useAuth } from "./lib/useAuth";
import { setAnalyticsUser, trackEvent } from "./lib/analytics";
import { Layout } from "./components/Layout";
import { SignInScreen } from "./components/SignInScreen";
import { Home } from "./routes/Home";
import { Import } from "./routes/Import";
import { NewRecipe } from "./routes/NewRecipe";
import { EditRecipe } from "./routes/EditRecipe";
import { RecipeDetail } from "./routes/RecipeDetail";
import { Chapters } from "./routes/Chapters";
import { Tags } from "./routes/Tags";
import { MealPlans } from "./routes/MealPlans";
import { MealPlanDetail } from "./routes/MealPlanDetail";
import { GroceryList } from "./routes/GroceryList";
import { Sharing } from "./routes/Sharing";
import { Account } from "./routes/Account";

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

  // Keep the GA4 user-id property tied to the signed-in user so the
  // analytics dashboard can stitch sessions across devices. Detach on
  // sign-out by passing null. setAnalyticsUser is silent when
  // analytics isn't configured, so this is a no-op in dev.
  useEffect(() => {
    setAnalyticsUser(user?.uid ?? null);
  }, [user?.uid]);

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
    <>
      <PageViewTracker />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipes/new" element={<NewRecipe />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes/:id/edit" element={<EditRecipe />} />
          <Route path="/import" element={<Import />} />
          <Route path="/chapters" element={<Chapters />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/meal-plans" element={<MealPlans />} />
          <Route path="/meal-plans/:id" element={<MealPlanDetail />} />
          <Route path="/meal-plans/:id/grocery" element={<GroceryList />} />
          <Route path="/settings/sharing" element={<Sharing />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Routes>
    </>
  );
}

/**
 * Fires a `page_view` event each time the SPA route changes. GA4's
 * automatic page tracking only fires on full document loads, which an
 * SPA never does after the initial mount — without this, the entire
 * post-auth surface would register as one "page view" forever.
 *
 * We log `page_path` rather than `page_location` so the URL stays
 * scrubbed of query parameters that occasionally hold recipe ids
 * (e.g. ?chapter=entree is fine but we don't pretend ids are PII-free).
 */
function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    // Normalize dynamic segments to their route templates so the
    // GA4 dashboard groups them sensibly (e.g. /recipes/abc and
    // /recipes/def both report as `/recipes/:id`). Without this we'd
    // see hundreds of distinct page paths and zero useful aggregates.
    trackEvent("page_view", {
      page_path: location.pathname,
      page_template: routeTemplate(location.pathname),
    });
  }, [location.pathname]);
  return null;
}

function routeTemplate(path: string): string {
  if (path === "/") return "/";
  if (path === "/recipes/new") return "/recipes/new";
  if (/^\/recipes\/[^/]+\/edit$/.test(path)) return "/recipes/:id/edit";
  if (/^\/recipes\/[^/]+$/.test(path)) return "/recipes/:id";
  if (/^\/meal-plans\/[^/]+\/grocery$/.test(path)) {
    return "/meal-plans/:id/grocery";
  }
  if (/^\/meal-plans\/[^/]+$/.test(path)) return "/meal-plans/:id";
  if (path === "/meal-plans") return "/meal-plans";
  if (path === "/import") return "/import";
  if (path === "/chapters") return "/chapters";
  if (path === "/tags") return "/tags";
  if (path === "/settings/sharing") return "/settings/sharing";
  if (path === "/account") return "/account";
  return path;
}
