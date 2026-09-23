import { useMemo, useState } from "react"
import { AppShell } from "./components/AppShell"
import { defaultCategories, seedRecipes } from "./data/recipes"
import { CategoriesScreen } from "./screens/CategoriesScreen"
import { ImportScreen } from "./screens/ImportScreen"
import { MoreScreen } from "./screens/MoreScreen"
import { RecipeDetailScreen } from "./screens/RecipeDetailScreen"
import { RecipeEditorScreen } from "./screens/RecipeEditorScreen"
import { RecipesScreen } from "./screens/RecipesScreen"
import type { PrimaryScreen, Recipe, Screen } from "./types"

export default function App() {
  const [screen, setScreen] = useState<Screen>("recipes")
  const [recipes, setRecipes] = useState<Recipe[]>(seedRecipes)
  const [selectedId, setSelectedId] = useState<string>(seedRecipes[0]?.id || "")
  const [editingId, setEditingId] = useState<string | null>(null)

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedId),
    [recipes, selectedId]
  )

  const editingRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === editingId),
    [editingId, recipes]
  )

  function navigate(next: PrimaryScreen) {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function openRecipe(recipe: Recipe) {
    setSelectedId(recipe.id)
    setScreen("detail")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function startNewRecipe() {
    setEditingId(null)
    setScreen("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function startEditRecipe() {
    if (!selectedRecipe) return
    setEditingId(selectedRecipe.id)
    setScreen("editor")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function saveRecipe(recipe: Recipe) {
    setRecipes((items) => {
      const existing = items.some((item) => item.id === recipe.id)
      if (existing) return items.map((item) => item.id === recipe.id ? recipe : item)
      return [recipe, ...items]
    })
    setSelectedId(recipe.id)
    setEditingId(null)
    setScreen("detail")
  }

  return (
    <AppShell screen={screen} onNavigate={navigate} onAdd={startNewRecipe}>
      {screen === "recipes" && (
        <RecipesScreen
          recipes={recipes}
          categories={defaultCategories}
          onOpen={openRecipe}
          onAdd={startNewRecipe}
        />
      )}

      {screen === "categories" && (
        <CategoriesScreen recipes={recipes} categories={defaultCategories} />
      )}

      {screen === "import" && <ImportScreen />}
      {screen === "more" && <MoreScreen />}

      {screen === "detail" && selectedRecipe && (
        <RecipeDetailScreen
          recipe={selectedRecipe}
          onBack={() => setScreen("recipes")}
          onEdit={startEditRecipe}
        />
      )}

      {screen === "editor" && (
        <RecipeEditorScreen
          categories={defaultCategories}
          existing={editingRecipe}
          onCancel={() => setScreen(editingRecipe ? "detail" : "recipes")}
          onSave={saveRecipe}
        />
      )}
    </AppShell>
  )
}
