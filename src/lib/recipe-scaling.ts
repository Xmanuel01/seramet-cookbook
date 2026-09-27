// Display-only recipe scaling. Never changes the approved standard.
export function numericQuantity(raw: string): { value: number; unit: string } | null {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*([a-zA-Z]+)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? { value, unit: match[2] || "" } : null;
}

export function scaleQuantity(raw: string, factor: number): string | null {
  const quantity = numericQuantity(raw);
  if (!quantity || !Number.isFinite(factor) || factor <= 0) return null;
  const scaled = quantity.value * factor;
  if (!Number.isFinite(scaled) || scaled <= 0) return null;
  // Kitchen display: one decimal for ordinary amounts. Very small positive
  // amounts retain precision rather than incorrectly displaying 0.0.
  const amount = scaled >= 0.05
    ? scaled.toFixed(1)
    : Number(scaled.toPrecision(6)).toString();
  return `${amount}${quantity.unit ? ` ${quantity.unit}` : ""}`;
}

export type MassUnit = "kg" | "g";
export type MassYield = { grams: number; source: "approved" | "estimated" };

// Finished batch is valid only when explicitly recorded as mass, or when
// portions x portion mass can be clearly marked as an ESTIMATE.
export function finishedBatchYield(recipe: {
  finishedYield?: string | null;
  portions: number;
  portionSize: string;
}): MassYield | null {
  const explicit = recipe.finishedYield ? numericQuantity(recipe.finishedYield) : null;
  if (explicit) {
    const grams = massToGrams(explicit.value, explicit.unit);
    if (grams !== null) return { grams, source: "approved" };
  }
  const portion = numericQuantity(recipe.portionSize);
  if (!portion || !Number.isFinite(recipe.portions) || recipe.portions <= 0) return null;
  const grams = massToGrams(portion.value, portion.unit);
  return grams === null ? null : { grams: grams * recipe.portions, source: "estimated" };
}

export function massToGrams(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (unit.toLowerCase()) {
    case "kg": return value * 1000;
    case "g": return value;
    default: return null;
  }
}

export function formatMass(grams: number, unit: MassUnit): string {
  const value = unit === "kg" ? grams / 1000 : grams;
  return Number(value.toPrecision(6)).toString();
}

// For an ingredient basis, convert only known like-for-like units.
export function convertedIngredientTarget(
  target: number,
  targetUnit: string,
  standardUnit: string,
): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  const units: Record<string, { kind: string; multiplier: number }> = {
    kg: { kind: "mass", multiplier: 1000 },
    g: { kind: "mass", multiplier: 1 },
    l: { kind: "volume", multiplier: 1000 },
    ml: { kind: "volume", multiplier: 1 },
  };
  const requested = units[targetUnit.toLowerCase()];
  const standard = units[standardUnit.toLowerCase()];
  if (!requested || !standard) return targetUnit.toLowerCase() === standardUnit.toLowerCase() ? target : null;
  if (requested.kind !== standard.kind) return null;
  return (target * requested.multiplier) / standard.multiplier;
}
