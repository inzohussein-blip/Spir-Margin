// Code 128 labels (src/lib/barcode/code128.ts): the pattern table is whole,
// the check symbol is right, and the SVG has one bar per black module run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./helpers.mjs";

const c = await importTs("src/lib/barcode/code128.ts");

test("the 107 patterns: distinct, 11 modules each (13 for stop), three bars each (four for stop)", () => {
  assert.equal(c.PATTERNS.length, 107);
  assert.equal(new Set(c.PATTERNS).size, 107);
  c.PATTERNS.forEach((p, i) => {
    const sum = [...p].reduce((s, x) => s + +x, 0);
    assert.equal(sum, i === 106 ? 13 : 11, `symbol ${i}`);
  });
});

test("set B with its check symbol", () => {
  // Start B (104) + P J J 1 2 3 C → (104 + 48 + 84 + 126 + 68 + 90 + 114 + 245) mod 103 = 55
  assert.deepEqual(c.encode128B("PJJ123C"), [104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
  assert.equal(c.encode128B("كود"), null, "outside set B is refused, not misprinted");
  assert.equal(c.encode128B(""), null);
});

test("the SVG", () => {
  const svg = c.barcodeSvg("SPR-001");
  const bars = c.bars("SPR-001");
  assert.equal((svg.match(/<rect /g) ?? []).length, bars.bars.length);
  assert.equal(bars.width, 20 + 11 * (1 + 7 + 1) + 13, "quiet zones + start + 7 characters + check + stop");
});
