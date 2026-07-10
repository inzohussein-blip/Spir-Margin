"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importTransactions, type ImportRow } from "@/app/actions/banking";

interface Account {
  id: string;
  account_name: string;
  currency: string;
}

// minimal CSV parser (handles quoted fields and embedded commas)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row); }
  return rows;
}

const COLS = ["date", "description", "deposit", "withdrawal", "reference_number", "transaction_id"] as const;
type Col = (typeof COLS)[number];

function toNum(s: string) {
  const n = Number((s || "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function CSVImport({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<Col, number>>({
    date: -1, description: -1, deposit: -1, withdrawal: -1, reference_number: -1, transaction_id: -1,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result));
      if (!rows.length) return;
      const [h, ...rest] = rows;
      setHeader(h);
      setDataRows(rest);
      // best-effort auto-map by header name
      const guess = { ...map };
      h.forEach((name, i) => {
        const n = name.toLowerCase();
        if (n.includes("date")) guess.date = i;
        else if (n.includes("desc") || n.includes("narration") || n.includes("detail")) guess.description = i;
        else if (n.includes("credit") || n.includes("deposit")) guess.deposit = i;
        else if (n.includes("debit") || n.includes("withdraw")) guess.withdrawal = i;
        else if (n.includes("ref")) guess.reference_number = i;
        else if (n.includes("id") || n.includes("transaction")) guess.transaction_id = i;
      });
      setMap(guess);
    };
    reader.readAsText(file);
  }

  const buildRows = (): ImportRow[] =>
    dataRows.map((r) => ({
      date: map.date >= 0 ? (r[map.date] || "").trim() : "",
      description: map.description >= 0 ? r[map.description] : "",
      deposit: map.deposit >= 0 ? toNum(r[map.deposit]) : 0,
      withdrawal: map.withdrawal >= 0 ? toNum(r[map.withdrawal]) : 0,
      reference_number: map.reference_number >= 0 ? r[map.reference_number] : "",
      transaction_id: map.transaction_id >= 0 ? r[map.transaction_id] : "",
    }));

  function runImport() {
    setMsg(null);
    const rows = buildRows().filter((r) => r.date && (r.deposit > 0 || r.withdrawal > 0));
    if (!accountId) { setMsg("Pick a bank account"); return; }
    if (!rows.length) { setMsg("No valid rows — check your column mapping (date + amount required)"); return; }
    const currency = accounts.find((a) => a.id === accountId)?.currency ?? "USD";
    start(async () => {
      const res = await importTransactions(accountId, currency, fileName, rows);
      if (res.ok) { setMsg(`Imported ${res.inserted} transaction(s)`); router.push(`/banking/${accountId}`); }
      else setMsg(`Error: ${res.error}`);
    });
  }

  const preview = buildRows().slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Bank account</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
      </div>

      {header.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">Map columns</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COLS.map((col) => (
                <label key={col} className="block text-sm">
                  <span className="text-slate-500">{col.replace(/_/g, " ")}</span>
                  <select
                    value={map[col]}
                    onChange={(e) => setMap({ ...map, [col]: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value={-1}>—</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>{h || `col ${i + 1}`}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Deposit</th>
                  <th className="px-3 py-2">Withdrawal</th>
                  <th className="px-3 py-2">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{r.date}</td>
                    <td className="px-3 py-1.5">{r.description}</td>
                    <td className="px-3 py-1.5 text-emerald-600">{r.deposit || ""}</td>
                    <td className="px-3 py-1.5 text-red-600">{r.withdrawal || ""}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.reference_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 text-xs text-slate-400">
              Showing {preview.length} of {dataRows.length} rows
            </div>
          </div>

          <button
            onClick={runImport}
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {pending ? "Importing…" : `Import ${dataRows.length} transactions`}
          </button>
        </>
      )}

      {msg && <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{msg}</div>}
    </div>
  );
}
