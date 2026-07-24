// Minimal, safe CSV builder for server-side (whole-table) exports. Values are
// quoted when they contain a comma, quote or newline; a UTF-8 BOM is prepended
// so Excel opens Arabic text correctly.

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header row and record rows (each a value array). */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  return "﻿" + lines.join("\r\n");
}

/** A downloadable text/csv Response for a Route Handler. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
