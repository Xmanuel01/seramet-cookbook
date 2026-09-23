import { ChevronRight } from "lucide-react"
import type { Recipe } from "../types"

export function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  return (
    <button type="button" className="recipe-card" onClick={onOpen}>
      <div className="recipe-image" style={{ background: recipe.image }}>
        <span className="recipe-badge">{recipe.category}</span>
      </div>
      <div className="recipe-card-body">
        <h3>{recipe.name}</h3>
        <div className="recipe-meta">
          <span>{recipe.portions} portions</span>
          <span aria-hidden="true">•</span>
          <span>{recipe.cookMinutes} min</span>
        </div>
        <span className="recipe-link">
          View recipe
          <ChevronRight size={13} />
        </span>
      </div>
    </button>
  )
}
