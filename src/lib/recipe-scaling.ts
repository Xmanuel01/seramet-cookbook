// Display-only scaling. Never changes the stored standard or guesses ambiguous amounts.
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
  const amount = Number(scaled.toPrecision(6)).toString();
  return `${amount}${quantity.unit ? ` ${quantity.unit}` : ""}`;
}
