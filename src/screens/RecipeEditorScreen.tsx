import { useMemo, useState } from "react"
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react"
import type { Ingredient, Recipe } from "../types"

type EditorStep = "basic" | "ingredients" | "method" | "review"

const editorSteps: Array<{ id: EditorStep; label: string }> = [
  { id: "basic", label: "Basic" },
  { id: "ingredients", label: "Ingredients" },
  { id: "method", label: "Method" },
  { id: "review", label: "Review" }
]

const gradients = [
  "linear-gradient(135deg, #2e756c 0%, #5d9f7a 48%, #d7b56f 100%)",
  "linear-gradient(135deg, #8a5b34 0%, #ca925d 46%, #50734a 100%)",
  "linear-gradient(135deg, #673127 0%, #a54c34 52%, #cf805c 100%)"
]

function cleanNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function RecipeEditorScreen({
  categories,
  existing,
  onCancel,
  onSave
}: {
  categories: string[]
  existing?: Recipe
  onCancel: () => void
  onSave: (recipe: Recipe) => void
}) {
  const [step, setStep] = useState<EditorStep>("basic")
  const [name, setName] = useState(existing?.name || "")
  const [category, setCategory] = useState(existing?.category || categories.find((item) => item !== "All") || "Main Dishes")
  const [description, setDescription] = useState(existing?.description || "")
  const [portions, setPortions] = useState(String(existing?.portions || 10))
  const [portionSize, setPortionSize] = useState(existing?.portionSize || "340 g")
  const [prepMinutes, setPrepMinutes] = useState(String(existing?.prepMinutes || 20))
  const [cookMinutes, setCookMinutes] = useState(String(existing?.cookMinutes || 45))
  const [notes, setNotes] = useState(existing?.notes || "")
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    existing?.ingredients || [{ id: "ingredient-1", name: "", quantity: "" }]
  )
  const [method, setMethod] = useState<string[]>(existing?.method || [""])

  const currentIndex = editorSteps.findIndex((item) => item.id === step)
  const canContinue = useMemo(() => {
    if (step === "basic") return name.trim().length > 1 && category.length > 0
    if (step === "ingredients") return ingredients.some((item) => item.name.trim() && item.quantity.trim())
    if (step === "method") return method.some((item) => item.trim())
    return true
  }, [category, ingredients, method, name, step])

  function next() {
    const nextStep = editorSteps[currentIndex + 1]
    if (nextStep && canContinue) setStep(nextStep.id)
  }

  function backStep() {
    const previous = editorSteps[currentIndex - 1]
    if (previous) setStep(previous.id)
    else onCancel()
  }

  function updateIngredient(id: string, key: "name" | "quantity", value: string) {
    setIngredients((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item))
  }

  function save() {
    const id = existing?.id || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recipe"
    const recipe: Recipe = {
      id,
      name: name.trim(),
      category,
      description: description.trim() || "Mona Swahili standard recipe.",
      portions: cleanNumber(portions, 10),
      portionSize: portionSize.trim() || "1 portion",
      prepMinutes: cleanNumber(prepMinutes, 0),
      cookMinutes: cleanNumber(cookMinutes, 0),
      image: existing?.image || gradients[Math.abs(name.length) % gradients.length],
      ingredients: ingredients.filter((item) => item.name.trim() && item.quantity.trim()),
      method: method.filter((item) => item.trim()),
      notes: notes.trim(),
      published: true
    }
    onSave(recipe)
  }

  return (
    <main className="content editor-content">
      <div className="editor-header">
        <button type="button" className="back-button" onClick={backStep}>
          <ArrowLeft size={16} />
          {currentIndex === 0 ? "Cancel" : "Back"}
        </button>
        <div>
          <div className="eyebrow">Recipe editor</div>
          <h1>{existing ? "Edit recipe" : "New recipe"}</h1>
        </div>
      </div>

      <div className="editor-progress" aria-label="Recipe editor progress">
        {editorSteps.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={step === item.id ? "active" : index < currentIndex ? "complete" : ""}
            onClick={() => index <= currentIndex && setStep(item.id)}
          >
            <span>{index < currentIndex ? <Check size={12} /> : index + 1}</span>
            {item.label}
          </button>
        ))}
      </div>

      <section className="editor-panel">
        {step === "basic" && (
          <div className="form-stack">
            <div className="field">
              <label htmlFor="recipe-name">Recipe name</label>
              <input id="recipe-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Beef Pilau" />
            </div>
            <div className="field">
              <label htmlFor="recipe-category">Category</label>
              <select id="recipe-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="recipe-description">Short description</label>
              <textarea id="recipe-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should kitchen staff know at a glance?" />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="recipe-portions">Yield</label>
                <input id="recipe-portions" inputMode="numeric" value={portions} onChange={(event) => setPortions(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="recipe-portion-size">Portion size</label>
                <input id="recipe-portion-size" value={portionSize} onChange={(event) => setPortionSize(event.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="recipe-prep">Prep minutes</label>
                <input id="recipe-prep" inputMode="numeric" value={prepMinutes} onChange={(event) => setPrepMinutes(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="recipe-cook">Cook minutes</label>
                <input id="recipe-cook" inputMode="numeric" value={cookMinutes} onChange={(event) => setCookMinutes(event.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === "ingredients" && (
          <div>
            <div className="section-heading">
              <div>
                <h2>Ingredients</h2>
                <p>Add only what the kitchen needs to execute the recipe.</p>
              </div>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => setIngredients((items) => [...items, { id: "ingredient-" + Date.now(), name: "", quantity: "" }])}
              >
                <Plus size={15} />
                Add
              </button>
            </div>
            <div className="editable-list">
              {ingredients.map((ingredient, index) => (
                <div className="editable-row" key={ingredient.id}>
                  <span className="row-index">{index + 1}</span>
                  <input value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, "name", event.target.value)} placeholder="Ingredient" />
                  <input value={ingredient.quantity} onChange={(event) => updateIngredient(ingredient.id, "quantity", event.target.value)} placeholder="Qty / unit" />
                  <button type="button" className="icon-danger" onClick={() => setIngredients((items) => items.filter((item) => item.id !== ingredient.id))} aria-label="Remove ingredient">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "method" && (
          <div>
            <div className="section-heading">
              <div>
                <h2>Method</h2>
                <p>Keep each instruction short and easy to follow during service.</p>
              </div>
              <button type="button" className="secondary-button compact" onClick={() => setMethod((items) => [...items, ""])}>
                <Plus size={15} />
                Step
              </button>
            </div>
            <div className="method-editor">
              {method.map((item, index) => (
                <div className="method-edit-row" key={String(index)}>
                  <span>{index + 1}</span>
                  <textarea
                    value={item}
                    onChange={(event) => setMethod((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    placeholder="Describe this step"
                  />
                  <button type="button" className="icon-danger" onClick={() => setMethod((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove method step">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="field top-gap">
              <label htmlFor="recipe-notes">Kitchen notes</label>
              <textarea id="recipe-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional consistency or service notes" />
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="review-stack">
            <div className="review-hero">
              <span>{category}</span>
              <h2>{name || "Untitled recipe"}</h2>
              <p>{description || "No description added."}</p>
            </div>
            <div className="review-grid">
              <div><span>Yield</span><strong>{portions} portions</strong></div>
              <div><span>Portion</span><strong>{portionSize}</strong></div>
              <div><span>Ingredients</span><strong>{ingredients.filter((item) => item.name.trim()).length}</strong></div>
              <div><span>Method steps</span><strong>{method.filter((item) => item.trim()).length}</strong></div>
            </div>
            <div className="chef-note">
              <span>Publishing</span>
              <p>This first version saves locally in the app. Supabase publishing and version history are the next backend milestone.</p>
            </div>
          </div>
        )}

        <div className="editor-actions">
          <button type="button" className="secondary-button" onClick={backStep}>
            {currentIndex === 0 ? "Cancel" : "Back"}
          </button>
          {step === "review" ? (
            <button type="button" className="primary-button" onClick={save}>
              <Check size={16} />
              Save recipe
            </button>
          ) : (
            <button type="button" className="primary-button" disabled={!canContinue} onClick={next}>
              Continue
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
