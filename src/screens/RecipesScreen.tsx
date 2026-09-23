import { useMemo, useState } from "react"
import { Plus, Search, SlidersHorizontal } from "lucide-react"
import { RecipeCard } from "../components/RecipeCard"
import type { Recipe } from "../types"

export function RecipesScreen({
  recipes,
  categories,
  onOpen,
  onAdd
}: {
  recipes: Recipe[]
  categories: string[]
  onOpen: (recipe: Recipe) => void
  onAdd: () => void
}) {
  const [category, setCategory] = useState("All")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes.filter((recipe) => {
      const categoryMatch = category === "All" || recipe.category === category
      const queryMatch =
        !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.category.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
        recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(q))
      return categoryMatch && queryMatch
    })
  }, [category, query, recipes])

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Kitchen library</div>
          <h1>Cookbook</h1>
          <p className="subtitle">Fast, consistent recipes for every Mona Swahili kitchen shift.</p>
        </div>
        <button type="button" className="primary-button desktop-only" onClick={onAdd}>
          <Plus size={16} />
          Add recipe
        </button>
      </div>

      <div className="search-row">
        <label className="search-wrap">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes or ingredients"
            aria-label="Search recipes"
          />
        </label>
        <button type="button" className="filter-button" aria-label="Recipe filters">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className="category-scroll" aria-label="Recipe categories">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? "chip active" : "chip"}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="results-line">
        <span>{filtered.length} recipes</span>
        {query && <span>Matching “{query}”</span>}
      </div>

      {filtered.length > 0 ? (
        <div className="recipe-grid">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onOpen={() => onOpen(recipe)} />
          ))}
        </div>
      ) : (
        <div className="empty-card">
          <Search size={22} />
          <strong>No recipes found</strong>
          <p>Try another search or category.</p>
        </div>
      )}
    </main>
  )
}
