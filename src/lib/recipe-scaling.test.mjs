import { test } from "node:test";
import assert from "node:assert/strict";
import { numericQuantity, scaleQuantity } from "./recipe-scaling.ts";

test("4 kg rice to 2 kg scales all ingredient units proportionally", () => {
  const standard = [{ quantity: "4 kg" }, { quantity: "500 g" }, { quantity: "200 ml" }];
  const original = structuredClone(standard);
  const factor = 2 / numericQuantity(standard[0].quantity).value;
  assert.deepEqual(
    standard.map((item) => scaleQuantity(item.quantity, factor)),
    ["2 kg", "250 g", "100 ml"],
  );
  assert.deepEqual(standard, original);
});

test("supports larger batches, decimals and unitless counts", () => {
  assert.equal(scaleQuantity("1.5 kg", 2), "3 kg");
  assert.equal(scaleQuantity(".5 L", 0.5), "0.25 L");
  assert.equal(scaleQuantity("2", 3), "6");
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
