// Sharing a document: WhatsApp numbers and links (src/lib/whatsapp.ts), and
// a real Excel file built with no library (src/lib/xlsx.ts), checked by
// unzipping it and reading its XML back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importTs } from "./helpers.mjs";

const { waNumber, waLink } = await importTs("src/lib/whatsapp.ts");
const { buildXlsx, asNumber } = await importTs("src/lib/xlsx.ts");

test("Iraqi mobile numbers become international, whatever way they were typed", () => {
  assert.equal(waNumber("0770 123 4567"), "9647701234567");
  assert.equal(waNumber("07701234567"), "9647701234567");
  assert.equal(waNumber("٠٧٧٠١٢٣٤٥٦٧"), "9647701234567", "Arabic-Indic digits");
  assert.equal(waNumber("+964 770 123 4567"), "9647701234567");
  assert.equal(waNumber("00964-770-123-4567"), "9647701234567");
  assert.equal(waNumber("7701234567"), "9647701234567");
  assert.equal(waNumber("123"), null, "too short to be a number");
  assert.equal(waNumber(null), null);
});

test("the link carries the message, with or without a number", () => {
  assert.equal(waLink("07701234567", "فاتورة 12"), `https://wa.me/9647701234567?text=${encodeURIComponent("فاتورة 12")}`);
  assert.equal(waLink(null, "x & y"), "https://wa.me/?text=x%20%26%20y");
});

test("numbers stay numbers in Excel; codes with leading zeros stay text", () => {
  assert.equal(asNumber("1,234.50"), 1234.5);
  assert.equal(asNumber("-7"), -7);
  assert.equal(asNumber("0770123"), null);
  assert.equal(asNumber("LAB-001"), null);
  assert.equal(asNumber("2026-09-25"), null);
  assert.equal(asNumber("12,34"), null, "not a thousands group");
});

test("the Excel file is a valid workbook: right to left, bold frozen header, Arabic text, numbers", () => {
  const rows = [
    ["المختبر", "الرقم", "المبلغ"],
    ["مختبر الكندي <A&B>", "INV-0001", "1,250.75"],
    ["مختبر بغداد", "0770", 300],
  ];
  const bytes = buildXlsx("الفواتير", rows);
  const dir = mkdtempSync(join(tmpdir(), "spir-xlsx-"));
  const file = join(dir, "t.xlsx");
  writeFileSync(file, bytes);
  const script = `
import zipfile, json, sys, xml.etree.ElementTree as ET
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
names = z.namelist()
ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
for n in names:
    if n.endswith(".xml") or n.endswith(".rels"): ET.fromstring(z.read(n))
sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
view = sheet.find("m:sheetViews/m:sheetView", ns)
cells = {}
for c in sheet.iter("{%s}c" % ns["m"]):
    v = c.find("m:v", ns); t = c.find("m:is/m:t", ns)
    cells[c.get("r")] = {"type": c.get("t"), "style": c.get("s"), "value": v.text if v is not None else t.text}
wb = ET.fromstring(z.read("xl/workbook.xml"))
print(json.dumps({"names": names, "rtl": view.get("rightToLeft"), "frozen": view.find("m:pane", ns).get("state"),
  "cells": cells, "sheet": wb.find("m:sheets/m:sheet", ns).get("name")}, ensure_ascii=False))
`;
  const out = JSON.parse(execFileSync("python3", ["-c", script, file], { encoding: "utf8" }));
  assert.ok(out.names.includes("xl/worksheets/sheet1.xml") && out.names.includes("[Content_Types].xml"));
  assert.equal(out.rtl, "1");
  assert.equal(out.frozen, "frozen");
  assert.equal(out.sheet, "الفواتير");
  assert.deepEqual(out.cells.A1, { type: "inlineStr", style: "1", value: "المختبر" });
  assert.equal(out.cells.A2.value, "مختبر الكندي <A&B>", "escaped and read back intact");
  assert.deepEqual(out.cells.C2, { type: null, style: null, value: "1250.75" }, "a number cell");
  assert.equal(out.cells.B3.type, "inlineStr", "0770 keeps its zero as text");
  assert.equal(out.cells.C3.value, "300");
});
