"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useRouter } from "next/navigation";
import {
  LandmarkIcon,
  ShuffleIcon,
  ScrollTextIcon,
  ListIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reconcile, unreconcile, applyRulesForAccount } from "@/app/actions/banking";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

// --- Faithful port of bankRecAtoms (subset) -------------------------------
export interface SelectedBank {
  id: string;
  account_name: string;
  bank: string;
  currency: string;
}
interface ActionLogEntry {
  at: string;
  action: "match" | "unmatch" | "rules";
  detail: string;
}
const selectedBankAtom = atomWithStorage<SelectedBank | null>(
  "bank-rec-selected-bank",
  null
);
const dateRangeAtom = atomWithStorage<{ from: string; to: string }>(
  "bank-rec-date",
  { from: "", to: "" }
);
const actionLogAtom = atomWithStorage<ActionLogEntry[]>("bank-rec-action-log", []);
const closingBalanceAtom = atom<number>(0);

interface Txn {
  id: string;
  date: string;
  deposit: number;
  withdrawal: number;
  description: string | null;
  reference_number: string | null;
  unallocated_amount: number;
  status: string;
}
interface Payment {
  id: string;
  payment_type: string;
  party_name: string | null;
  paid_amount: number;
  received_amount: number;
  reference_no: string | null;
  posting_date: string;
}

const money = (n: number) => Number(n || 0).toLocaleString();

export function ReconcileWorkbench({ accounts }: { accounts: SelectedBank[] }) {
  const router = useRouter();
  const [selectedBank, setSelectedBank] = useAtom(selectedBankAtom);
  const [dateRange, setDateRange] = useAtom(dateRangeAtom);
  const [log, setLog] = useAtom(actionLogAtom);
  const [closing, setClosing] = useAtom(closingBalanceAtom);

  const [txns, setTxns] = useState<Txn[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<Txn | null>(null);
  const [pending, start] = useTransition();

  // default the selected bank once
  useEffect(() => {
    if (!selectedBank && accounts.length) setSelectedBank(accounts[0]);
  }, [accounts, selectedBank, setSelectedBank]);

  const load = useCallback(async () => {
    if (!selectedBank) return;
    const supabase = createClient();
    let tq = supabase
      .from("bank_transactions")
      .select("*")
      .eq("bank_account_id", selectedBank.id)
      .neq("status", "reconciled")
      .neq("status", "cancelled")
      .order("date", { ascending: false });
    if (dateRange.from) tq = tq.gte("date", dateRange.from);
    if (dateRange.to) tq = tq.lte("date", dateRange.to);
    const [{ data: t }, { data: p }] = await Promise.all([
      tq,
      supabase
        .from("payment_entries")
        .select(
          "id, payment_type, party_name, paid_amount, received_amount, reference_no, posting_date, is_reconciled"
        )
        .eq("is_reconciled", false)
        .order("posting_date", { ascending: false }),
    ]);
    setTxns((t as Txn[]) ?? []);
    setPayments((p as Payment[]) ?? []);
  }, [selectedBank, dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  function addLog(action: ActionLogEntry["action"], detail: string) {
    setLog([{ at: new Date().toISOString(), action, detail }, ...log].slice(0, 100));
  }

  const fits = (t: Txn, p: Payment) =>
    t.deposit > 0
      ? Number(p.received_amount) === Number(t.deposit)
      : Number(p.paid_amount) === Number(t.withdrawal);

  function doMatch(p: Payment) {
    if (!selectedTxn || !selectedBank) return;
    start(async () => {
      const res = await reconcile(selectedTxn.id, p.id, selectedBank.id);
      if (res.ok) {
        addLog("match", `${p.party_name ?? "payment"} → ${selectedTxn.reference_number ?? selectedTxn.date}`);
        setSelectedTxn(null);
        await load();
        router.refresh();
      }
    });
  }

  function autoMatch() {
    if (!selectedBank) return;
    start(async () => {
      const res = await applyRulesForAccount(selectedBank.id);
      if (res.ok) {
        addLog("rules", `matched ${res.matched} transaction(s)`);
        await load();
      }
    });
  }

  const unreconciledAmount = txns.reduce((s, t) => s + Number(t.unallocated_amount), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LandmarkIcon size={16} />
          <span className="font-medium text-foreground">Bank Reconciliation</span>
          <Badge theme="violet" variant="subtle">Beta</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBank?.id ?? ""}
            onChange={(e) =>
              setSelectedBank(accounts.find((a) => a.id === e.target.value) ?? null)
            }
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} — {a.bank}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <Tabs defaultValue="match">
        <TabsList>
          <TabsTrigger value="match"><ShuffleIcon size={14} className="mr-1" /> Match &amp; Reconcile</TabsTrigger>
          <TabsTrigger value="statement"><ScrollTextIcon size={14} className="mr-1" /> Statement</TabsTrigger>
          <TabsTrigger value="log"><ListIcon size={14} className="mr-1" /> Action Log</TabsTrigger>
        </TabsList>

        {/* Match & Reconcile */}
        <TabsContent value="match" className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Select a bank line, then match a payment. Unreconciled:{" "}
              <span className="font-semibold text-amber-600">{money(unreconciledAmount)}</span>
            </p>
            <Button variant="subtle" size="sm" onClick={autoMatch} disabled={pending}>
              {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
              Auto-match by rules
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Unreconciled transactions ({txns.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-slate-100">
                  {txns.length === 0 && (
                    <li className="flex items-center gap-2 px-4 py-6 text-sm text-emerald-600">
                      <CheckCircleIcon size={16} /> All reconciled
                    </li>
                  )}
                  {txns.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelectedTxn(t)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                          selectedTxn?.id === t.id ? "bg-blue-50 ring-1 ring-inset ring-brand" : ""
                        }`}
                      >
                        <div>
                          <div className="font-medium text-foreground">{t.description ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{t.date} · {t.reference_number ?? "no ref"}</div>
                        </div>
                        <span className={t.deposit > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                          {t.deposit > 0 ? "+" : "-"}{money(t.deposit || t.withdrawal)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Open payments ({payments.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-slate-100">
                  {payments.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">No open payments</li>
                  )}
                  {payments.map((p) => {
                    const good = selectedTxn && fits(selectedTxn, p);
                    return (
                      <li key={p.id} className={`flex items-center justify-between px-4 py-3 text-sm ${good ? "bg-emerald-50" : ""}`}>
                        <div>
                          <div className="font-medium text-foreground">{p.party_name ?? "—"} <span className="text-xs text-muted-foreground">({p.payment_type})</span></div>
                          <div className="text-xs text-muted-foreground">{p.posting_date} · {p.reference_no ?? "no ref"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{money(p.received_amount || p.paid_amount)}</span>
                          <Button variant="solid" size="sm" disabled={!selectedTxn || pending} onClick={() => doMatch(p)}>Match</Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Statement */}
        <TabsContent value="statement" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Reconciliation statement</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-center gap-3">
                <span className="w-56 text-muted-foreground">Closing balance as per bank statement</span>
                <input type="number" value={closing} onChange={(e) => setClosing(Number(e.target.value))}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-muted-foreground">Unreconciled amount</span>
                <span className="font-semibold text-amber-600">{money(unreconciledAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difference (closing − unreconciled)</span>
                <span className="font-semibold">{money(closing - unreconciledAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action log */}
        <TabsContent value="log" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Action log ({log.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {log.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No actions yet</li>}
                {log.map((l, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{l.detail}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge theme={l.action === "unmatch" ? "red" : l.action === "rules" ? "blue" : "green"} variant="subtle">{l.action}</Badge>
                      {new Date(l.at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
