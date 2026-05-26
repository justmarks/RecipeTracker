import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Import } from "./routes/Import";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/import" element={<Import />} />
    </Routes>
  );
}
