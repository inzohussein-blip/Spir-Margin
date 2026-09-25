// What a refused save says. src/lib/db/errors.ts is run as it is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTsLinked } from "./helpers.mjs";

const { describeDbError } = await importTsLinked("src/lib/db/errors.ts", { "@/lib/i18n": "src/lib/i18n.ts" });

test("a duplicate names the field in Arabic, even when the table name has an underscore", () => {
  const msg = describeDbError("ar", {
    message: 'duplicate key value violates unique constraint "sales_stages_name_key"',
    code: "23505",
    table: "sales_stages",
    constraint: "sales_stages_name_key",
    detail: "Key (name)=(Won) already exists.",
  });
  assert.match(msg, /«Won»/);
  assert.doesNotMatch(msg, /stages|_/);
});

test("a business rule a function raised is shown as it was written", () => {
  const text = "الدفعة تتجاوز المبلغ المستحق (المتبقّي 10.00)";
  assert.equal(describeDbError("ar", { message: text, code: "P0001" }), text);
});

test("a raised check_violation keeps its own text; a real CHECK constraint gets the general sentence", () => {
  const text = "الكمية غير كافية لـ كِت: المتاح 3، المطلوب 5";
  assert.equal(describeDbError("ar", { message: text, code: "23514" }), text);
  const general = describeDbError("ar", { message: "new row violates check constraint", code: "23514", constraint: "kit_batches_qty_check" });
  assert.notEqual(general, "new row violates check constraint");
  assert.match(general, /[؀-ۿ]/);
});

test("anything else is not dressed up as validation", () => {
  assert.equal(describeDbError("ar", { message: "connection lost", code: "08006" }), null);
});
