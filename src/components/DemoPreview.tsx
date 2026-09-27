import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./AppShell";
import { seedRecipes } from "../data/recipes";
import { demoAvailable } from "../lib/demo";
import { CategoriesScreen } from "../screens/CategoriesScreen";
import { RecipeDetailScreen } from "../screens/RecipeDetailScreen";
import { RecipesScreen } from "../screens/RecipesScreen";
import type { PrimaryScreen, Screen } from "../types";

// Separate, read-only demo tree: never loads real profile/recipes, writes data, or calls Supabase.
export function DemoPreview({ onExit }: { onExit: () => void }) {
  const [expired, setExpired] = useState(!demoAvailable());
  const [screen, setScreen] = useState<Screen>("recipes");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(seedRecipes[0].id);
  const selected = seedRecipes.find((item) => item.id === selectedId);
  const categories = useMemo(() => ["All", ...new Set(seedRecipes.map((r) => r.category))], []);

  useEffect(() => {
    const check = () => setExpired(!demoAvailable());
    const timer = window.setInterval(check, 15_000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);

  if (expired || !demoAvailable()) {
    return <main className="auth-shell"><section className="auth-card"><h1>Demo expired</h1><p className="subtitle">This preview is no longer available.</p><button type="button" className="primary-button auth-submit" onClick={onExit}>Return to sign in</button></section></main>;
  }

  function navigate(next: PrimaryScreen) {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return <AppShell screen={screen} branchLabel="Demo workspace" onNavigate={navigate} onAdd={() => setScreen("more")}>
    <div className="demo-banner" role="status"><strong>Demo preview · Sample data only</strong><button type="button" onClick={onExit}>Exit demo</button></div>
    {screen === "recipes" && <RecipesScreen recipes={seedRecipes} categories={categories} category={category} query={query} onCategoryChange={setCategory} onQueryChange={setQuery} onOpen={(recipe) => { setSelectedId(recipe.id); setScreen("detail"); }} onAdd={() => setScreen("more")} />}
    {screen === "categories" && <CategoriesScreen recipes={seedRecipes} categories={categories} onSelect={(value) => { setCategory(value); setQuery(""); setScreen("recipes"); }} />}
    {screen === "detail" && selected && <RecipeDetailScreen recipe={selected} onBack={() => setScreen("recipes")} onEdit={() => setScreen("more")} />}
    {screen === "import" && <main className="content"><h1>Import cookbook</h1><div className="demo-panel"><strong>Unavailable in demo</strong><p>Sign in with a real Seramet account to preview and import documents.</p></div></main>}
    {screen === "more" && <main className="content"><h1>Demo workspace</h1><div className="demo-panel"><strong>Read-only sample content</strong><p>Explore recipes, categories, ingredient scaling, and kitchen instructions. Editing, importing and account actions require normal sign-in.</p><button type="button" className="primary-button" onClick={onExit}>Exit demo</button></div></main>}
  </AppShell>;
}
