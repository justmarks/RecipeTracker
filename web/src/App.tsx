import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Import } from "./routes/Import";
import { NewRecipe } from "./routes/NewRecipe";
import { EditRecipe } from "./routes/EditRecipe";
import { RecipeDetail } from "./routes/RecipeDetail";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/recipes/new" element={<NewRecipe />} />
      <Route path="/recipes/:id" element={<RecipeDetail />} />
      <Route path="/recipes/:id/edit" element={<EditRecipe />} />
      <Route path="/import" element={<Import />} />
    </Routes>
  );
}
