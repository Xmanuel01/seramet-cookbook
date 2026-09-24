import { useEffect, useMemo, useState } from "react"
import { Calculator, RotateCcw, Scale, TriangleAlert } from "lucide-react"
import type { Ingredient, Recipe } from "../types"

type UnitDimension = "MASS" | "VOLUME" | "COUNT" | "OTHER"

type ScaleBasis = {
  key: string
  label: string
  quantity: number
  unitCode: string
  unitLabel: string
  dimension: UnitDimension
  scaleNumerator: number
  scaleDenominator: number
}

type UnitOption = {
  code: string
  label: string
  dimension: UnitDimension
  scaleNumerator: number
  scaleDenominator: number
}

const COMMON_UNITS: UnitOption[] = [
  { code: "KG", label: "kg", dimension: "MASS", scaleNumerator: 1, scaleDenominator: 1 },
  { code: "G", label: "g", dimension: "MASS", scaleNumerator: 1, scaleDenominator: 1000 },
  { code: "L", label: "L", dimension: "VOLUME", scaleNumerator: 1, scaleDenominator: 1 },
  { code: "ML", label: "ml", dimension: "VOLUME", scaleNumerator: 1, scaleDenominator: 1000 },
  { code: "PC", label: "pc", dimension: "COUNT", scaleNumerator: 1, scaleDenominator: 1 },
]

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—"
  if (Math.abs(value) >= 100) return value.toFixed(1).replace(/\.0$/, "")
  if (Math.abs(value) >= 10) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
  if (Math.abs(value) >= 1) return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
}

function ingredientBasis(ingredient: Ingredient): ScaleBasis | null {
  if (!ingredient.quantityValue || ingredient.quantityValue <= 0 || !ingredient.unitLabel) return null
  return {
    key: "ingredient:" + ingredient.id,
    label: ingredient.name,
    quantity: ingredient.quantityValue,
    unitCode: ingredient.unitCode || ingredient.unitLabel,
    unitLabel: ingredient.unitLabel,
    dimension: ingredient.unitDimension || "OTHER",
    scaleNumerator: ingredient.unitScaleNumerator || 1,
    scaleDenominator: ingredient.unitScaleDenominator || 1,
  }
}

function recipeYieldBasis(recipe: Recipe): ScaleBasis | null {
  if (!recipe.yieldQuantity || recipe.yieldQuantity <= 0 || !recipe.yieldUnitLabel) return null
  return {
    key: "yield",
    label: "Recipe yield",
    quantity: recipe.yieldQuantity,
    unitCode: recipe.yieldUnitCode || recipe.yieldUnitLabel,
    unitLabel: recipe.yieldUnitLabel,
    dimension: recipe.yieldUnitDimension || "OTHER",
    scaleNumerator: recipe.yieldUnitScaleNumerator || 1,
    scaleDenominator: recipe.yieldUnitScaleDenominator || 1,
  }
}

function unitOptionsFor(basis: ScaleBasis): UnitOption[] {
  const options = COMMON_UNITS.filter((unit) => unit.dimension === basis.dimension)
  const current: UnitOption = {
    code: basis.unitCode,
    label: basis.unitLabel,
    dimension: basis.dimension,
    scaleNumerator: basis.scaleNumerator,
    scaleDenominator: basis.scaleDenominator,
  }
  if (!options.some((unit) => unit.code === current.code)) return [current]
  return options.map((unit) => unit.code === current.code ? current : unit)
}

function toBase(value: number, scaleNumerator: number, scaleDenominator: number) {
  return value * (scaleNumerator / scaleDenominator)
}

export function BatchScaler({ recipe }: { recipe: Recipe }) {
  const bases = useMemo(() => {
    const result: ScaleBasis[] = []
    const yieldBasis = recipeYieldBasis(recipe)
    if (yieldBasis) result.push(yieldBasis)
    for (const ingredient of recipe.ingredients) {
      const basis = ingredientBasis(ingredient)
      if (basis) result.push(basis)
    }
    return result
  }, [recipe])

  const [basisKey, setBasisKey] = useState("")
  const [targetQuantity, setTargetQuantity] = useState("")
  const [targetUnitCode, setTargetUnitCode] = useState("")

  const basis = bases.find((item) => item.key === basisKey) || bases[0] || null
  const unitOptions = basis ? unitOptionsFor(basis) : []
  const targetUnit = unitOptions.find((unit) => unit.code === targetUnitCode) || unitOptions[0] || null

  useEffect(() => {
    if (!basis) return
    if (basisKey !== basis.key) setBasisKey(basis.key)
    setTargetQuantity(formatNumber(basis.quantity))
    setTargetUnitCode(basis.unitCode)
  }, [basis?.key])

  if (!basis) {
    return (
      <section className="batch-scaler batch-scaler-unavailable">
        <Calculator size={18} />
        <div>
          <strong>Batch calculator unavailable</strong>
          <span>This recipe needs structured Seramet quantities before it can be safely scaled.</span>
        </div>
      </section>
    )
  }

  const numericTarget = Number(targetQuantity)
  const standardBase = toBase(basis.quantity, basis.scaleNumerator, basis.scaleDenominator)
  const targetBase = targetUnit && Number.isFinite(numericTarget) && numericTarget > 0
    ? toBase(numericTarget, targetUnit.scaleNumerator, targetUnit.scaleDenominator)
    : 0
  const factor = standardBase > 0 && targetBase > 0 ? targetBase / standardBase : 0
  const validFactor = Number.isFinite(factor) && factor > 0

  function resetToStandard() {
    setTargetQuantity(formatNumber(basis.quantity))
    setTargetUnitCode(basis.unitCode)
  }

  function chooseMultiplier(multiplier: number) {
    setTargetQuantity(formatNumber(basis.quantity * multiplier))
    setTargetUnitCode(basis.unitCode)
  }

  return (
    <section className="batch-scaler">
      <div className="batch-scaler-heading">
        <div className="batch-scaler-title">
          <Calculator size={18} />
          <div>
            <strong>Batch calculator</strong>
            <span>Scale today’s production without changing the approved master recipe.</span>
          </div>
        </div>
        <button type="button" className="batch-reset" onClick={resetToStandard}>
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="batch-control-grid">
        <label className="batch-field">
          <span>Scale by</span>
          <select
            value={basis.key}
            onChange={(event) => {
              const next = bases.find((item) => item.key === event.target.value)
              if (!next) return
              setBasisKey(next.key)
              setTargetQuantity(formatNumber(next.quantity))
              setTargetUnitCode(next.unitCode)
            }}
          >
            {bases.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label + " — standard " + formatNumber(item.quantity) + " " + item.unitLabel}
              </option>
            ))}
          </select>
        </label>

        <div className="batch-field">
          <span>Standard</span>
          <div className="batch-standard">
            <Scale size={15} />
            <strong>{formatNumber(basis.quantity) + " " + basis.unitLabel}</strong>
          </div>
        </div>

        <label className="batch-field batch-target-field">
          <span>I want to cook / use</span>
          <div className="batch-target-input">
            <input
              type="number"
              min="0.0001"
              step="any"
              inputMode="decimal"
              value={targetQuantity}
              onChange={(event) => setTargetQuantity(event.target.value)}
              aria-label="Target batch quantity"
            />
            <select
              value={targetUnit?.code || basis.unitCode}
              onChange={(event) => setTargetUnitCode(event.target.value)}
              aria-label="Target batch unit"
            >
              {unitOptions.map((unit) => (
                <option key={unit.code} value={unit.code}>{unit.label}</option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="batch-quick-actions">
        {[0.5, 1, 1.5, 2].map((multiplier) => (
          <button type="button" key={multiplier} onClick={() => chooseMultiplier(multiplier)}>
            {multiplier === 0.5 ? "½ batch" : multiplier === 1 ? "Standard" : multiplier + "×"}
          </button>
        ))}
      </div>

      <div className="batch-factor">
        <span>Production factor</span>
        <strong>{validFactor ? formatNumber(factor) + "×" : "Enter a target quantity"}</strong>
        {validFactor && (
          <small>
            {factor < 1
              ? formatNumber((1 - factor) * 100) + "% smaller than the standard batch"
              : factor > 1
                ? formatNumber((factor - 1) * 100) + "% larger than the standard batch"
                : "Standard recipe quantities"}
          </small>
        )}
      </div>

      <div className="batch-scaled-list">
        <div className="batch-scaled-header">
          <strong>Calculated ingredients</strong>
          <span>{validFactor ? "Scaled from " + basis.label : "Waiting for target quantity"}</span>
        </div>

        {recipe.ingredients.map((ingredient, index) => {
          const structured = ingredient.quantityValue !== undefined && ingredient.quantityValue !== null
          const scaledValue = structured && validFactor ? ingredient.quantityValue! * factor : null
          const fractionalWholeItem =
            scaledValue !== null &&
            ingredient.unitDimension === "COUNT" &&
            Math.abs(scaledValue - Math.round(scaledValue)) > 0.0001

          return (
            <div className="batch-ingredient-row" key={ingredient.id}>
              <span className="row-index">{index + 1}</span>
              <span className="batch-ingredient-name">
                {ingredient.name}
                {fractionalWholeItem && (
                  <small className="batch-rounding-warning">
                    <TriangleAlert size={11} /> whole-item quantity needs chef rounding
                  </small>
                )}
              </span>
              <span className="batch-original">{ingredient.quantity}</span>
              <strong>
                {scaledValue !== null
                  ? formatNumber(scaledValue) + (ingredient.unitLabel ? " " + ingredient.unitLabel : "")
                  : ingredient.quantity}
              </strong>
            </div>
          )
        })}
      </div>

      <p className="batch-scaler-footnote">
        Ingredient quantities scale proportionally. Prep and cook times are not scaled automatically because equipment capacity and cooking behaviour may change with batch size.
      </p>
    </section>
  )
}
