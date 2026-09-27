import { useState } from "react";
import type { Recipe } from "../types";
import { KitchenProductionMode } from "./KitchenProductionMode";
import { clearKitchenDraft, kitchenDraftKey, readKitchenDraft, recipeDraftFingerprint, type KitchenDraft } from "../lib/kitchen-draft";
import {
  convertedIngredientTarget,
  finishedBatchYield,
  formatMass,
  numericQuantity,
  scaleQuantity,
  type MassUnit,
} from "../lib/recipe-scaling";

type Basis = "finished" | "portions" | `ingredient:${string}`;

export function ProductionScaler({ recipe, sessionScope }: {
  recipe: Recipe;
  sessionScope?: { tenantId: string; userId: string };
}) {
  const finished = finishedBatchYield(recipe);
  const options = recipe.ingredients.flatMap((ingredient) => {
    const quantity = numericQuantity(ingredient.quantity);
    return quantity ? [{ ...ingredient, ...quantity }] : [];
  });
  const [basis, setBasis] = useState<Basis>(finished ? "finished" : "portions");
  const [productionActive, setProductionActive] = useState(false);
  const draftKey = sessionScope ? kitchenDraftKey(sessionScope.tenantId, sessionScope.userId, recipe.id) : undefined;
  const fingerprint = recipeDraftFingerprint(recipe);
  const expected = {
    recipeId: recipe.id,
    recipeVersion: recipe.recipeVersionId ?? "local",
    fingerprint,
    ingredientIds: recipe.ingredients.map((item) => item.id),
    ambiguousIds: recipe.ingredients.filter((item) => numericQuantity(item.quantity) === null).map((item) => item.id),
    stepCount: recipe.method.length,
  };
  const [savedDraft, setSavedDraft] = useState<KitchenDraft | null>(() =>
    draftKey ? readKitchenDraft(draftKey, expected) : null);
  const [activeDraft, setActiveDraft] = useState<KitchenDraft | null>(null);
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

  function openProduction(resume: boolean) {
    if (resume && savedDraft) {
      setBasis(savedDraft.basis as Basis);
      setTarget(savedDraft.target);
      setUnit(savedDraft.unit as MassUnit);
      setActiveDraft(savedDraft);
    } else {
      if (draftKey) clearKitchenDraft(draftKey);
      setSavedDraft(null);
      setActiveDraft(null);
    }
    setProductionActive(true);
  }

  if (productionActive && valid) {
    return (
      <KitchenProductionMode
        key={`${recipe.id}:${basis}:${target}:${unit}`}
        recipe={recipe}
        factor={factor}
        batchLabel={`${targetNumber} ${unitLabel}`}
        onExit={() => {
          setProductionActive(false);
          setActiveDraft(null);
          setSavedDraft(draftKey ? readKitchenDraft(draftKey, expected) : null);
        }}
        draftKey={draftKey}
        fingerprint={fingerprint}
        basis={basis}
        target={target}
        unit={unit}
        initialDraft={activeDraft}
      />
    );
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
        <div className="kitchen-start">
          <div>
            <strong>Ready to cook?</strong>
            <small>Measure ingredients and follow the recipe one step at a time.</small>
          </div>
          {savedDraft && <div className="kitchen-resume">
            <strong>Unfinished checklist found</strong>
            <small>Saved on this browser. Recipe version and ingredients still match.</small>
            <button type="button" className="secondary-button" onClick={() => openProduction(true)}>
              Resume saved batch
            </button>
            <button type="button" className="kitchen-discard" onClick={() => {
              if (draftKey) clearKitchenDraft(draftKey);
              setSavedDraft(null);
            }}>Discard saved checklist</button>
          </div>}
          <button
            type="button"
            className="primary-button kitchen-main-action"
            disabled={!valid || recipe.ingredients.length === 0 || recipe.method.length === 0}
            onClick={() => openProduction(false)}
          >
            {savedDraft ? "Start a new batch" : "Prepare this batch"}
          </button>
          {recipe.method.length === 0 && <small>Approved cooking instructions are needed to start cooking mode.</small>}
        </div>
      </section>
    </>
  );
}
