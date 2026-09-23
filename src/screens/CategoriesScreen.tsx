import { ChevronRight, LayoutGrid } from "lucide-react"
import type { Recipe } from "../types"

export function CategoriesScreen({ recipes, categories }: { recipes: Recipe[]; categories: string[] }) {
  const items = categories
    .filter((item) => item !== "All")
    .map((name) => ({ name, count: recipes.filter((recipe) => recipe.category === name).length }))

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Organisation</div>
          <h1>Categories</h1>
          <p className="subtitle">Simple grouping so kitchen staff can find a recipe quickly.</p>
        </div>
      </div>

      <section className="list-panel">
        {items.map((item) => (
          <button type="button" className="list-row" key={item.name}>
            <span className="list-icon"><LayoutGrid size={16} /></span>
            <span className="list-main">
              <strong>{item.name}</strong>
              <small>{item.count} recipes</small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </section>
    </main>
  )
}
