import { test } from "node:test";
import assert from "node:assert/strict";
import {
  numericQuantity, scaleQuantity, finishedBatchYield, massToGrams,
  formatMass, convertedIngredientTarget,
} from "./recipe-scaling.ts";

test("4 kg rice to 2 kg scales all ingredient units proportionally", () => {
  const standard = [{ quantity: "4 kg" }, { quantity: "500 g" }, { quantity: "200 ml" }];
  const original = structuredClone(standard);
  const factor = 2 / numericQuantity(standard[0].quantity).value;
  assert.deepEqual(standard.map((item) => scaleQuantity(item.quantity, factor)), ["2.0 kg", "250.0 g", "100.0 ml"]);
  assert.deepEqual(standard, original);
});

test("supports larger batches, decimals and unitless counts", () => {
  assert.equal(scaleQuantity("1.5 kg", 2), "3.0 kg");
  assert.equal(scaleQuantity(".5 L", 0.5), "0.3 L");
  assert.equal(scaleQuantity("2", 3), "6.0");
  assert.equal(scaleQuantity("0.001 g", 0.01), "0.00001 g");
});

test("does not guess ranges, mixed quantities or qualitative amounts", () => {
  for (const raw of ["to taste", "1–2 kg", "1/2 cup", "2 x 400 g", "about 4 kg", "", "-2 g"]) {
    assert.equal(scaleQuantity(raw, 0.5), null, raw);
  }
});

test("rejects zero, negative and non-finite production amounts", () => {
  for (const factor of [0, -1, NaN, Infinity]) assert.equal(scaleQuantity("4 kg", factor), null);
});

test("explicit finished weight scales 2kg batch to 3.5kg with factor 1.75", () => {
  const yieldData = finishedBatchYield({ finishedYield: "2 kg", portions: 10, portionSize: "340 g" });
  assert.deepEqual(yieldData, { grams: 2000, source: "approved" });
  const factor = massToGrams(3.5, "kg") / yieldData.grams;
  assert.equal(factor, 1.75);
  assert.deepEqual(["2 kg", "1.5 kg", "400 g", "200 ml"].map(q => scaleQuantity(q, factor)),
    ["3.5 kg", "2.6 kg", "700.0 g", "350.0 ml"]);
});

test("only infer a finished weight from numeric portion mass and flag as estimated", () => {
  assert.deepEqual(finishedBatchYield({ portions: 10, portionSize: "340 g" }), { grams: 3400, source: "estimated" });
  assert.equal(finishedBatchYield({ portions: 10, portionSize: "1 plate" }), null);
  assert.equal(finishedBatchYield({ portions: 10, portionSize: "to taste" }), null);
  assert.equal(finishedBatchYield({ portions: 10, portionSize: "1 piece" }), null);
});

test("kg and g convert exactly while unrelated units cannot masquerade as mass", () => {
  assert.equal(formatMass(3400, "kg"), "3.4");
  assert.equal(formatMass(3400, "g"), "3400");
  assert.equal(convertedIngredientTarget(3500, "g", "kg"), 3.5);
  assert.equal(convertedIngredientTarget(2, "kg", "ml"), null);
  assert.equal(massToGrams(-1, "kg"), null);
});

test("ingredient amounts display one decimal while tiny values never become zero", () => {
  assert.equal(scaleQuantity("1.5 kg", 1.7647066667), "2.6 kg");
  assert.equal(scaleQuantity("500 g", 1.764706), "882.4 g");
  assert.equal(scaleQuantity("200 ml", 1.764706), "352.9 ml");
  assert.equal(scaleQuantity("0.02 g", 1), "0.02 g");
  assert.equal(scaleQuantity("0.001 g", 0.01), "0.00001 g");
});
