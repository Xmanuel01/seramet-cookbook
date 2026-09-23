import { useState } from "react"
import { ArrowLeft, Clock3, Pencil, Scale, UsersRound } from "lucide-react"
import type { Recipe } from "../types"

type DetailTab = "ingredients" | "method" | "notes"

export function RecipeDetailScreen({
  recipe,
  onBack,
  onEdit
}: {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
}) {
  const [tab, setTab] = useState<DetailTab>("ingredients")

  return (
    <main className="content detail-content">
      <div className="detail-toolbar">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Recipes
        </button>
        <button type="button" className="secondary-button compact" onClick={onEdit}>
          <Pencil size={15} />
          Edit
        </button>
      </div>

      <section className="detail-card">
        <div className="detail-hero" style={{ background: recipe.image }}>
          <div className="detail-hero-overlay">
            <span>{recipe.category}</span>
            <h1>{recipe.name}</h1>
            <p>{recipe.description}</p>
          </div>
        </div>

        <div className="detail-body">
          <div className="stat-grid">
            <div className="stat">
              <Clock3 size={16} />
              <span>Prep</span>
              <strong>{recipe.prepMinutes} min</strong>
            </div>
            <div className="stat">
              <Clock3 size={16} />
              <span>Cook</span>
              <strong>{recipe.cookMinutes} min</strong>
            </div>
            <div className="stat">
              <Scale size={16} />
              <span>Portion</span>
              <strong>{recipe.portionSize}</strong>
            </div>
            <div className="stat">
              <UsersRound size={16} />
              <span>Yield</span>
              <strong>{recipe.portions}</strong>
            </div>
          </div>

          <div className="detail-tabs" role="tablist">
            {(["ingredients", "method", "notes"] as DetailTab[]).map((item) => (
              <button
                type="button"
                role="tab"
                key={item}
                aria-selected={tab === item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {tab === "ingredients" && (
            <div className="tab-panel">
              {recipe.ingredients.map((ingredient, index) => (
                <div className="ingredient-row" key={ingredient.id}>
                  <span className="row-index">{index + 1}</span>
                  <span>{ingredient.name}</span>
                  <strong>{ingredient.quantity}</strong>
                </div>
              ))}
            </div>
          )}

          {tab === "method" && (
            <div className="tab-panel method-list">
              {recipe.method.map((step, index) => (
                <div className="method-step" key={String(index) + step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "notes" && (
            <div className="tab-panel">
              <div className="chef-note">
                <span>Kitchen note</span>
                <p>{recipe.notes || "No special kitchen notes have been added yet."}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
