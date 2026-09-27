import { useState } from "react";
import type { Recipe } from "../types";
import {
  convertedIngredientTarget,
  finishedBatchYield,
  formatMass,
  numericQuantity,
  scaleQuantity,
  type MassUnit,
} from "../lib/recipe-scaling";

type Basis = "finished" | "portions" | `ingredient:${string}`;

export function ProductionScaler({ recipe }: { recipe: Recipe }) {
  const finished = finishedBatchYield(recipe);
  const options = recipe.ingredients.flatMap((ingredient) => {
    const quantity = numericQuantity(ingredient.quantity);
    return quantity ? [{ ...ingredient, ...quantity }] : [];
  });
  const [basis, setBasis] = useState<Basis>(finished ? "finished" : "portions");
  const [unit, setUnit] = useState<MassUnit>("kg");
  const [target, setTarget] = useState(
    finished ? formatMass(finished.grams, "kg") : String(recipe.portions),
  );
  const selected = basis.startsWith("ingredient:")
    ? options.find((item) => item.id === basis.slice("ingredient:".length))
    : undefined;
  const standard = basis === "finished"
    ? (finished?.grams ?? 0)
    : selected?.value ?? recipe.portions;
  const targetNumber = Number(target);
  const converted = basis === "finished"
    ? targetNumber * (unit === "kg" ? 1000 : 1)
    : selected ? convertedIngredientTarget(targetNumber, selected.unit, selected.unit) : targetNumber;
  const factor = converted === null ? NaN : converted / standard;
  const valid = target.trim() !== "" && Number.isFinite(factor) && factor > 0 && standard > 0;
  const standardLabel = basis === "finished" && finished
    ? `${formatMass(finished.grams, unit)} ${unit}`
    : selected ? selected.quantity : `${recipe.portions} portions`;
  const unitLabel = basis === "finished" ? unit : selected?.unit || "portions";
  const reviewCount = valid
    ? recipe.ingredients.filter((item) => scaleQuantity(item.quantity, factor) === null).length
    : 0;

  function chooseBasis(next: Basis) {
    setBasis(next);
    if (next === "finished" && finished) {
      setUnit("kg");
      setTarget(formatMass(finished.grams, "kg"));
    } else if (next === "portions") {
      setTarget(String(recipe.portions));
    } else {
      setTarget(String(options.find((item) => item.id === next.slice("ingredient:".length))?.value ?? ""));
    }
  }

  function changeUnit(next: MassUnit) {
    if (basis === "finished" && target.trim() !== "" && Number.isFinite(targetNumber)) {
      setTarget(formatMass(targetNumber * (unit === "kg" ? 1000 : 1), next));
    }
    setUnit(next);
  }

  return (
    <>
      <section className="production-panel" aria-labelledby="production-heading">
        <div className="batch-heading">
          <div>
            <h2 id="production-heading">Batch calculator</h2>
            <p>Enter how much you want to prepare.</p>
          </div>
          <span className="batch-badge">Live calculation</span>
        </div>

        <div className="field">
          <label htmlFor="production-basis">Calculate by</label>
          <select
            id="production-basis"
            value={basis}
            onChange={(event) => chooseBasis(event.target.value as Basis)}
          >
            {finished && <option value="finished">Finished batch weight</option>}
            <option value="portions">Number of portions</option>
            {options.map((item) => (
              <option key={item.id} value={`ingredient:${item.id}`}>
                {item.name} ({item.quantity})
              </option>
            ))}
          </select>
        </div>
        <div className="batch-standard">
          <span>Standard recipe</span>
          <strong>{standardLabel}</strong>
        </div>
        {basis === "finished" && finished?.source === "estimated" && (
          <p className="batch-caution">
            Estimated from {recipe.portions} × {recipe.portionSize} portions. Confirm actual cooked yield
            before relying on finished-weight quantities.
          </p>
        )}
        <div className="field">
          <label htmlFor="production-target">Quantity to prepare</label>
          <div className="batch-target-row">
            <input
              id="production-target"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 3.5"
              value={target}
              aria-invalid={!valid}
              aria-describedby="production-help"
              onChange={(event) => {
                const next = event.target.value;
                if (/^(?:\d*(?:\.\d*)?)?$/.test(next)) setTarget(next);
              }}
            />
            {basis === "finished" ? (
              <select
                aria-label="Batch weight unit"
                value={unit}
                onChange={(event) => changeUnit(event.target.value as MassUnit)}
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
              </select>
            ) : <span className="batch-unit">{unitLabel}</span>}
          </div>
        </div>
        <div id="production-help" className="batch-result" aria-live="polite">
          {valid ? (
            <>
              <span>Batch preview</span>
              <div className="batch-result-summary">
                <strong>{targetNumber} {unitLabel}</strong>
                <span className="batch-multiplier">{Number(factor.toPrecision(4))}× standard</span>
              </div>
              <small>Ingredient quantities update automatically.</small>
            </>
          ) : <span>Enter a quantity greater than zero.</span>}
        </div>
        {reviewCount > 0 && <p className="batch-caution">
          {reviewCount} ingredient {reviewCount === 1 ? "amount needs" : "amounts need"} chef review.
          Ambiguous amounts are never calculated.
        </p>}
        <button type="button" className="back-button" onClick={() => setTarget(
          basis === "finished" && finished ? formatMass(finished.grams, unit)
            : basis === "portions" ? String(recipe.portions) : String(selected?.value ?? ""),
        )}>
          Reset to standard
        </button>
      </section>

      <section className="tab-panel" aria-label="Calculated ingredients" aria-live="polite">
        <h3 className="batch-ingredients-title">Ingredients for this batch</h3>
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
              <strong>{valid ? scaled ?? ingredient.quantity : "—"}</strong>
            </div>
          );
        })}
      </section>
    </>
  );
}
