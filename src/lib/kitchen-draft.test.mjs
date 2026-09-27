import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kitchenDraftKey, recipeDraftFingerprint, validateKitchenDraft, KITCHEN_DRAFT_MAX_AGE_MS,
} from "./kitchen-draft.ts";

const recipe = {
  id: "pilau", version: 4, recipeVersionId: "version-4", contentRevision: 2,
  portions: 10, portionSize: "340 g",
  ingredients: [{ id: "rice", name: "Rice", quantity: "2 kg" }, { id: "salt", name: "Salt", quantity: "to taste" }],
  method: ["Measure", "Cook"],
};
const fingerprint = recipeDraftFingerprint(recipe);
const expected = {
  recipeId: recipe.id, recipeVersion: recipe.recipeVersionId, fingerprint,
  ingredientIds: ["rice", "salt"], ambiguousIds: ["salt"], stepCount: 2,
};
const now = Date.parse("2026-09-27T12:00:00Z");
function draft(overrides = {}) {
  return {
    schema: 1, recipeId: "pilau", recipeVersion: "version-4",
    fingerprint, basis: "ingredient:rice", target: "3.5", unit: "kg",
    checked: ["rice", "salt"], verified: ["salt"], phase: "cook",
    completedSteps: [0], stepIndex: 1, secondsLeft: 300,
    deadline: now + 300_000, savedAt: now, ...overrides,
  };
}
const parse = (value) => validateKitchenDraft(JSON.stringify(value), expected, now);

test("allows only scoped authenticated draft keys", () => {
  assert.notEqual(kitchenDraftKey("tenant1", "chef1", "pilau"), kitchenDraftKey("tenant1", "chef2", "pilau"));
  assert.notEqual(kitchenDraftKey("tenant1", "chef1", "pilau"), kitchenDraftKey("tenant2", "chef1", "pilau"));
  assert.throws(() => kitchenDraftKey("", "chef", "pilau"));
});

test("restores a valid step and running timer checkpoint", () => {
  assert.deepEqual(parse(draft()), draft());
  assert.equal(validateKitchenDraft(null, expected, now), null);
});

test("rejects changed recipes, stale drafts and future timestamps", () => {
  assert.notEqual(recipeDraftFingerprint({ ...recipe, ingredients: [{ ...recipe.ingredients[0], quantity: "3 kg" }, recipe.ingredients[1]] }), fingerprint);
  assert.equal(parse(draft({ recipeVersion: "version-3" })), null);
  assert.equal(parse(draft({ fingerprint: "stale" })), null);
  assert.equal(parse(draft({ savedAt: now - KITCHEN_DRAFT_MAX_AGE_MS - 1 })), null);
  assert.equal(parse(draft({ savedAt: now + 61_000 })), null);
});

test("refuses tampered or unsafe cooking checkpoints", () => {
  for (const patch of [
    { target: "-5" }, { target: "not-a-number" }, { basis: "ingredient:nonexistent" },
    { checked: ["rice", "rice"] }, { checked: ["rice", "external"] },
    { verified: [] }, { completedSteps: [2] }, { stepIndex: 3 },
    { secondsLeft: -1 }, { phase: "complete" },
  ]) assert.equal(parse(draft(patch)), null, JSON.stringify(patch));
});

test("accepts incomplete preparation but forbids early cooking", () => {
  assert.ok(parse(draft({ phase: "prep", checked: [], verified: [], completedSteps: [], stepIndex: 0 })));
  assert.equal(parse(draft({ checked: ["rice"], verified: ["salt"] })), null);
  assert.equal(parse(draft({ checked: ["rice", "salt"], verified: [] })), null);
});
