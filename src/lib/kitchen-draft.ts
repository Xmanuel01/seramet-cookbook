/** Unofficial device draft only. Never use browser state as a Seramet production ledger. */
export type KitchenDraft = {
  schema: 1;
  recipeId: string;
  recipeVersion: string;
  fingerprint: string;
  basis: string;
  target: string;
  unit: string;
  checked: string[];
  verified: string[];
  phase: "prep" | "cook";
  completedSteps: number[];
  stepIndex: number;
  secondsLeft: number;
  deadline: number | null;
  savedAt: number;
};

export const KITCHEN_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PREFIX = "seramet-cookbook:kitchen-draft:v1";
export function kitchenDraftKey(tenantId: string, userId: string, recipeId: string) {
  if (![tenantId, userId, recipeId].every((s) => s.length > 0 && s.length <= 200)) {
    throw new Error("Authenticated user and recipe scope required for saving kitchen drafts.");
  }
  return [PREFIX, tenantId, userId, recipeId].map(encodeURIComponent).join(":");
}

/** Fingerprint standard quantities and directions so a changed recipe cannot resume old measurements. */
export function recipeDraftFingerprint(recipe: {
  id: string;
  version?: number;
  recipeVersionId?: string | null;
  contentRevision?: number;
  portions: number;
  portionSize: string;
  ingredients: Array<{ id: string; name: string; quantity: string }>;
  method: string[];
}) {
  const canonical = JSON.stringify([
    recipe.id, recipe.version ?? null, recipe.recipeVersionId ?? null,
    recipe.contentRevision ?? null, recipe.portions, recipe.portionSize,
    recipe.ingredients.map((item) => [item.id, item.name, item.quantity]),
    recipe.method,
  ]);
  // Small deterministic cache validator, NOT an authentication signature.
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < canonical.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(canonical.charCodeAt(i))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function validateKitchenDraft(
  raw: string | null,
  expected: { recipeId: string; recipeVersion: string; fingerprint: string; ingredientIds: string[]; ambiguousIds: string[]; stepCount: number },
  now = Date.now(),
): KitchenDraft | null {
  if (!raw || raw.length > 40000) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    if (d.schema !== 1 || d.recipeId !== expected.recipeId || d.recipeVersion !== expected.recipeVersion ||
      d.fingerprint !== expected.fingerprint || typeof d.basis !== "string" ||
      typeof d.target !== "string" || !/^\d*\.?\d+$/.test(d.target) ||
      Number(d.target) <= 0 || !Number.isFinite(Number(d.target)) ||
      !["kg", "g"].includes(String(d.unit)) ||
      !(d.basis === "finished" || d.basis === "portions" ||
        (d.basis.startsWith("ingredient:") && expected.ingredientIds.includes(d.basis.slice(11)))) ||
      !Number.isFinite(d.savedAt) ||
      Number(d.savedAt) > now + 60_000 || now - Number(d.savedAt) > KITCHEN_DRAFT_MAX_AGE_MS ||
      !["prep", "cook"].includes(String(d.phase)) ||
      !Array.isArray(d.checked) || !Array.isArray(d.verified) ||
      !Array.isArray(d.completedSteps) ||
      !Number.isInteger(d.stepIndex) || Number(d.stepIndex) < 0 ||
      Number(d.stepIndex) >= expected.stepCount ||
      !Number.isInteger(d.secondsLeft) || Number(d.secondsLeft) < 0 || Number(d.secondsLeft) > 172800 ||
      (d.deadline !== null && (!Number.isFinite(d.deadline) || Number(d.deadline) < 0))) return null;
    const ids = new Set(expected.ingredientIds);
    const validIds = (value: unknown[]) => value.length <= ids.size &&
      value.every((id) => typeof id === "string" && ids.has(id)) &&
      new Set(value).size === value.length;
    if (!validIds(d.checked) || !validIds(d.verified) ||
      d.completedSteps.length > expected.stepCount ||
      d.completedSteps.some((index: unknown) => !Number.isInteger(index) || Number(index) < 0 || Number(index) >= expected.stepCount) ||
      new Set(d.completedSteps).size !== d.completedSteps.length) return null;
    const verified = d.verified as string[];
    if (d.phase === "cook" && (d.checked.length !== ids.size ||
      !expected.ambiguousIds.every((id) => verified.includes(id)))) return null;
    if (d.phase === "cook" && d.completedSteps.length && !d.completedSteps.includes(0)) return null;
    return d as KitchenDraft;
  } catch {
    return null;
  }
}

export function readKitchenDraft(key: string, expected: Parameters<typeof validateKitchenDraft>[1]): KitchenDraft | null {
  try {
    const value = window.localStorage.getItem(key);
    const draft = validateKitchenDraft(value, expected);
    if (!draft && value) window.localStorage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

export function saveKitchenDraft(key: string, draft: KitchenDraft): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearKitchenDraft(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* local storage unavailable */ }
}
