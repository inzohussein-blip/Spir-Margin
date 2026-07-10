"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { UploadCloudIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { importTransactions, type ImportRow } from "@/app/actions/banking";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Account { id: string; account_name: string; currency: string; }

// ---- CSV parsing ---------------------------------------------------------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
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

// ---- amount / date detection (ported concept from import_utils) ----------
type AmountMode = "separate" | "signed" | "debit_credit";

const COLS = [
  "date", "description", "reference_number", "transaction_id",
  "deposit", "withdrawal", "amount", "debit_credit", "balance",
] as const;
type Col = (typeof COLS)[number];
const COL_LABELS: Record<Col, string> = {
  date: "Date", description: "Description", reference_number: "Reference",
  transaction_id: "Transaction id", deposit: "Deposit", withdrawal: "Withdrawal",
  amount: "Amount (signed)", debit_credit: "Debit/Credit flag", balance: "Balance",
};

function num(s: string) {
  const neg = /^\(.*\)$/.test((s || "").trim()); // (123.45) => -123.45
  const n = Number((s || "").replace(/[()]/g, "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : neg ? -Math.abs(n) : n;
}

// normalise a date cell to ISO yyyy-mm-dd, detecting dd/mm vs mm/dd
function detectAndParseDate(cell: string, preferDMY: boolean): string {
  const s = (cell || "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = "20" + y;
    const day = preferDMY ? a : b;
    const mon = preferDMY ? b : a;
    return `${y}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function StatementImport({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<Col, number>>(
    Object.fromEntries(COLS.map((c) => [c, -1])) as Record<Col, number>
  );
  const [amountMode, setAmountMode] = useState<AmountMode>("separate");
  const [preferDMY, setPreferDMY] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onDrop = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result));
      if (!rows.length) return;
      const [h, ...rest] = rows;
      setHeader(h);
      setDataRows(rest);
      const g = { ...map };
      h.forEach((name, i) => {
        const n = name.toLowerCase();
        if (n.includes("date")) g.date = i;
        else if (/desc|narration|detail|particular/.test(n)) g.description = i;
        else if (/credit|deposit|cr amount/.test(n)) g.deposit = i;
        else if (/debit|withdraw|dr amount/.test(n)) g.withdrawal = i;
        else if (n === "amount" || n.includes("amount")) g.amount = i;
        else if (n.includes("balance")) g.balance = i;
        else if (n.includes("ref")) g.reference_number = i;
        else if (/type|dr\/cr|cr\/dr/.test(n)) g.debit_credit = i;
      });
      // pick amount mode from what we found
      if (g.deposit >= 0 || g.withdrawal >= 0) setAmountMode("separate");
      else if (g.debit_credit >= 0) setAmountMode("debit_credit");
      else if (g.amount >= 0) setAmountMode("signed");
      setMap(g);
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "text/csv": [".csv"] }, multiple: false,
  });

  const rows: ImportRow[] = useMemo(() => {
    const cell = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
    return dataRows.map((r) => {
      let deposit = 0, withdrawal = 0;
      if (amountMode === "separate") {
        deposit = num(cell(r, map.deposit));
        withdrawal = num(cell(r, map.withdrawal));
      } else if (amountMode === "signed") {
        const a = num(cell(r, map.amount));
        if (a >= 0) deposit = a; else withdrawal = Math.abs(a);
      } else {
        const a = Math.abs(num(cell(r, map.amount)));
        const flag = cell(r, map.debit_credit).trim().toUpperCase();
        if (/^(C|CR|CREDIT|DEPOSIT)/.test(flag)) deposit = a; else withdrawal = a;
      }
      return {
        date: detectAndParseDate(cell(r, map.date), preferDMY),
        description: cell(r, map.description),
        reference_number: cell(r, map.reference_number),
        transaction_id: cell(r, map.transaction_id),
        deposit, withdrawal,
      };
    });
  }, [dataRows, map, amountMode, preferDMY]);

  const valid = rows.filter((r) => r.date && (r.deposit > 0 || r.withdrawal > 0));
  const totals = useMemo(() => ({
    credits: valid.reduce((s, r) => s + r.deposit, 0),
    debits: valid.reduce((s, r) => s + r.withdrawal, 0),
    from: valid.map((r) => r.date).sort()[0] ?? "—",
    to: valid.map((r) => r.date).sort().slice(-1)[0] ?? "—",
  }), [valid]);

  function runImport() {
    setMsg(null);
    if (!accountId) return setMsg("Pick a bank account");
    if (!valid.length) return setMsg("No valid rows — check the column mapping (date + amount required)");
    const currency = accounts.find((a) => a.id === accountId)?.currency ?? "USD";
    start(async () => {
      const res = await importTransactions(accountId, currency, fileName, valid);
      if (res.ok) { setMsg(`Imported ${res.inserted} transaction(s)`); router.push(`/banking/reconcile`); }
      else setMsg(`Error: ${res.error}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">Bank account</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>)}
          </select>
        </label>
      </div>

      {/* Dropzone */}
      <div {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm ${
          isDragActive ? "border-brand bg-blue-50" : "border-outline-gray-2 bg-surface-white"
        }`}>
        <input {...getInputProps()} />
        <UploadCloudIcon className="text-ink-gray-4" />
        {fileName
          ? <span className="flex items-center gap-2 font-medium text-ink-gray-8"><FileTextIcon size={14} /> {fileName}</span>
          : <span className="text-ink-gray-5">Drop a CSV statement here, or click to choose</span>}
      </div>

      {header.length > 0 && (
        <>
          {/* Detection controls */}
          <Card>
            <CardHeader><CardTitle>Detected format</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <label className="block">
                <span className="text-ink-gray-5">Amount format</span>
                <select value={amountMode} onChange={(e) => setAmountMode(e.target.value as AmountMode)}
                  className="mt-1 w-full rounded-md border border-outline-gray-2 px-2 py-1.5">
                  <option value="separate">Separate deposit / withdrawal columns</option>
                  <option value="signed">Single signed amount column</option>
                  <option value="debit_credit">Amount + Debit/Credit flag</option>
                </select>
              </label>
              <label className="block">
                <span className="text-ink-gray-5">Date order</span>
                <select value={preferDMY ? "dmy" : "mdy"} onChange={(e) => setPreferDMY(e.target.value === "dmy")}
                  className="mt-1 w-full rounded-md border border-outline-gray-2 px-2 py-1.5">
                  <option value="dmy">Day/Month/Year</option>
                  <option value="mdy">Month/Day/Year</option>
                </select>
              </label>
              <div className="flex items-end">
                <Badge theme="blue" variant="subtle">{valid.length} valid rows</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Column mapping */}
          <Card>
            <CardHeader><CardTitle>Map columns</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COLS.map((col) => (
                <label key={col} className="block text-sm">
                  <span className="text-ink-gray-5">{COL_LABELS[col]}</span>
                  <select value={map[col]} onChange={(e) => setMap({ ...map, [col]: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-outline-gray-2 px-2 py-1.5">
                    <option value={-1}>—</option>
                    {header.map((h, i) => <option key={i} value={i}>{h || `col ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Summary + preview */}
          <Card>
            <CardHeader><CardTitle>Statement summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><div className="text-xs text-ink-gray-5">Rows</div><div className="font-semibold">{valid.length}</div></div>
                <div><div className="text-xs text-ink-gray-5">Credits</div><div className="font-semibold text-emerald-600">{totals.credits.toLocaleString()}</div></div>
                <div><div className="text-xs text-ink-gray-5">Debits</div><div className="font-semibold text-red-600">{totals.debits.toLocaleString()}</div></div>
                <div><div className="text-xs text-ink-gray-5">Period</div><div className="font-semibold">{totals.from} → {totals.to}</div></div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-outline-gray-2">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-ink-gray-5">
                    <th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Deposit</th><th className="px-3 py-2">Withdrawal</th><th className="px-3 py-2">Ref</th>
                  </tr></thead>
                  <tbody className="divide-y divide-outline-gray-1">
                    {rows.slice(0, 6).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{r.date || <span className="text-red-500">?</span>}</td>
                        <td className="px-3 py-1.5">{r.description}</td>
                        <td className="px-3 py-1.5 text-emerald-600">{r.deposit || ""}</td>
                        <td className="px-3 py-1.5 text-red-600">{r.withdrawal || ""}</td>
                        <td className="px-3 py-1.5 text-ink-gray-5">{r.reference_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Button variant="solid" size="md" onClick={runImport} disabled={pending}>
            {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
            Import {valid.length} transactions
          </Button>
        </>
      )}

      {msg && <div className="rounded-md bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-7">{msg}</div>}
    </div>
  );
}
