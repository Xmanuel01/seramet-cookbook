import { useState } from "react";
import type { Recipe } from "../types";
import { numericQuantity, scaleQuantity } from "../lib/recipe-scaling";

export function ProductionScaler({ recipe }: { recipe: Recipe }) {
  const [basis, setBasis] = useState("");
  const [target, setTarget] = useState(String(recipe.portions));
  const options = recipe.ingredients.flatMap((ingredient) => {
    const quantity = numericQuantity(ingredient.quantity);
    return quantity ? [{ ...ingredient, ...quantity }] : [];
  });
  const selected = options.find((item) => item.id === basis);
  const standard = selected?.value ?? recipe.portions;
  const unit =
    selected?.unit ||
    (basis === "" ? (recipe.recipeVersionId ? "yield units" : "portions") : "units");
  const value = Number(target);
  const factor = value / standard;
  const valid = target.trim() !== "" && value > 0 && standard > 0 && Number.isFinite(factor);

  return (
    <>
      <section className="production-panel" aria-labelledby="production-heading">
        <h2 id="production-heading">Production quantity</h2>
        <div className="field">
          <label htmlFor="production-basis">Scale using</label>
          <select
            id="production-basis"
            value={basis}
            onChange={(event) => {
              const next = event.target.value;
              setBasis(next);
              setTarget(String(options.find((item) => item.id === next)?.value ?? recipe.portions));
            }}
          >
            <option value="">Recipe yield</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.quantity})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="production-target">Required quantity ({unit})</label>
          <input
            id="production-target"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={target}
            aria-invalid={!valid}
            aria-describedby="production-help"
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
        <p id="production-help">
          {valid
            ? `Standard: ${standard} ${unit}. Showing ${Number(factor.toPrecision(4))}× the standard recipe. Stored quantities stay unchanged.`
            : "Enter a quantity greater than zero to calculate ingredients."}
        </p>
        <button type="button" className="back-button" onClick={() => setTarget(String(standard))}>
          Reset to standard
        </button>
      </section>
      <div className="tab-panel" aria-label="Calculated ingredients" aria-live="polite">
        {recipe.ingredients.map((ingredient, index) => {
          const scaled = valid ? scaleQuantity(ingredient.quantity, factor) : null;
          return (
            <div className="ingredient-row" key={ingredient.id}>
              <span className="row-index">{index + 1}</span>
              <span>
                {ingredient.name}
                {valid && scaled === null && (
                  <small className="quantity-review">Confirm quantity with chef</small>
                )}
              </span>
              <strong>{valid ? (scaled ?? ingredient.quantity) : "—"}</strong>
            </div>
          );
        })}
      </div>
    </>
  );
}
