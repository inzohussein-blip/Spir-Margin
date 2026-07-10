"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reconcile, applyRulesForAccount } from "@/app/actions/banking";

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
  naming_series: string | null;
  payment_type: string;
  party_name: string | null;
  paid_amount: number;
  received_amount: number;
  reference_no: string | null;
  posting_date: string;
}

export function ReconcilePanel({
  accountId,
  transactions,
  payments,
}: {
  accountId: string;
  transactions: Txn[];
  payments: Payment[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Txn | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const txnAmount = (t: Txn) => t.deposit || t.withdrawal;
  // a payment "fits" a transaction when its direction and amount line up
  function fits(t: Txn, p: Payment) {
    if (t.deposit > 0) return Number(p.received_amount) === Number(t.deposit);
    return Number(p.paid_amount) === Number(t.withdrawal);
  }

  function doMatch(p: Payment) {
    if (!selected) return;
    setMsg(null);
    start(async () => {
      const res = await reconcile(selected.id, p.id, accountId);
      if (res.ok) {
        setMsg(`Matched ${selected.reference_number ?? ""} → reconciled`);
        setSelected(null);
        router.refresh();
      } else {
        setMsg(`Error: ${res.error}`);
      }
    });
  }

  function autoMatch() {
    setMsg(null);
    start(async () => {
      const res = await applyRulesForAccount(accountId);
      if (res.ok) {
        setMsg(`Rule engine matched ${res.matched} transaction(s)`);
        router.refresh();
      } else setMsg(`Error: ${res.error}`);
    });
  }

  const candidates = selected
    ? [...payments].sort((a, b) => (fits(selected, b) ? 1 : 0) - (fits(selected, a) ? 1 : 0))
    : payments;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-gray-5">
          Select a bank line on the left, then click a matching payment on the right.
        </p>
        <button
          onClick={autoMatch}
          disabled={pending}
          className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-blue-50 disabled:opacity-50"
        >
          Auto-match by rules
        </button>
      </div>

      {msg && (
        <div className="rounded-md bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-7">{msg}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bank transactions */}
        <div className="rounded-xl border border-outline-gray-2 bg-surface-white">
          <div className="border-b border-outline-gray-1 px-4 py-2 text-sm font-semibold text-ink-gray-7">
            Unreconciled transactions ({transactions.length})
          </div>
          <ul className="divide-y divide-outline-gray-1">
            {transactions.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-gray-4">All reconciled 🎉</li>
            )}
            {transactions.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelected(t)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-surface-gray-1 ${
                    selected?.id === t.id ? "bg-blue-50 ring-1 ring-inset ring-brand" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium text-ink-gray-8">
                      {t.description ?? "—"}
                    </div>
                    <div className="text-xs text-ink-gray-4">
                      {t.date} · {t.reference_number ?? "no ref"}
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      t.deposit > 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.deposit > 0 ? "+" : "-"}
                    {txnAmount(t).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Payment entries */}
        <div className="rounded-xl border border-outline-gray-2 bg-surface-white">
          <div className="border-b border-outline-gray-1 px-4 py-2 text-sm font-semibold text-ink-gray-7">
            Open payments ({payments.length})
          </div>
          <ul className="divide-y divide-outline-gray-1">
            {candidates.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-gray-4">No open payments</li>
            )}
            {candidates.map((p) => {
              const good = selected && fits(selected, p);
              const amt = p.received_amount || p.paid_amount;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    good ? "bg-emerald-50" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium text-ink-gray-8">
                      {p.party_name ?? "—"}{" "}
                      <span className="text-xs text-ink-gray-4">({p.payment_type})</span>
                    </div>
                    <div className="text-xs text-ink-gray-4">
                      {p.posting_date} · {p.reference_no ?? "no ref"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-ink-gray-7">
                      {Number(amt).toLocaleString()}
                    </span>
                    <button
                      disabled={!selected || pending}
                      onClick={() => doMatch(p)}
                      className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-40"
                    >
                      Match
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
