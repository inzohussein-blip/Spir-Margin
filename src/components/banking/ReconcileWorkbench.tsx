"use client";

import { useEffect, useState, useTransition, useCallback, useMemo } from "react";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  LandmarkIcon,
  ShuffleIcon,
  ScrollTextIcon,
  ListIcon,
  CheckCircleIcon,
  Loader2Icon,
  ClockAlertIcon,
  Link2OffIcon,
  LinkIcon,
} from "lucide-react";
import {
  reconcile,
  applyRulesForAccount,
  createVoucherAndReconcile,
  createVouchersForTransactions,
  loadAllocations,
  unallocate,
  loadReconcileData,
  loadReconcileLog,
  type Allocation,
  type BankActionLogEntry,
} from "@/app/actions/banking";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useLocale } from "@/components/LocaleProvider";
import { t as tr } from "@/lib/i18n";

// --- Faithful port of bankRecAtoms (subset) -------------------------------
export interface SelectedBank {
  id: string;
  account_name: string;
  bank: string;
  currency: string;
}
const selectedBankAtom = atomWithStorage<SelectedBank | null>(
  "bank-rec-selected-bank",
  null
);
const dateRangeAtom = atomWithStorage<{ from: string; to: string }>(
  "bank-rec-date",
  { from: "", to: "" }
);
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
  /** What is left of this payment after earlier allocations (migration 0100). */
  remaining: number;
  allocated: number;
}

const money = (n: number) => Number(n || 0).toLocaleString("en-US");
/** Amounts agree to within half a fils, so rounding never reads as a mismatch. */
const EPS = 0.005;

type Quality = "full" | "partial" | "none";

/**
 * How well a payment fits the selected bank line. A deposit is settled by a
 * payment received, a withdrawal by one paid — anything else is the wrong
 * direction however neatly the amounts line up. Amounts that leave a
 * remainder on either side are a partial match, which is now allowed rather
 * than hidden.
 */
function quality(t: Txn, p: Payment): Quality {
  const isDeposit = Number(t.deposit) > 0;
  const rightWay = isDeposit ? p.payment_type === "receive" : p.payment_type === "pay";
  if (!rightWay) return "none";
  const left = Number(t.unallocated_amount);
  const have = Number(p.remaining);
  if (have <= EPS || left <= EPS) return "none";
  return Math.abs(have - left) <= EPS ? "full" : "partial";
}

/** What clicking "match" would allocate: as much as both sides can take. */
function allocatable(t: Txn, p: Payment) {
  return Math.min(Number(t.unallocated_amount), Number(p.remaining));
}

export function ReconcileWorkbench({ accounts }: { accounts: SelectedBank[] }) {
  const locale = useLocale();
  const [selectedBank, setSelectedBank] = useAtom(selectedBankAtom);
  const [dateRange, setDateRange] = useAtom(dateRangeAtom);
  const [closing, setClosing] = useAtom(closingBalanceAtom);

  const [log, setLog] = useState<BankActionLogEntry[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [older, setOlder] = useState({ n: 0, total: 0 });
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<Txn | null>(null);
  const [voucherParty, setVoucherParty] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  // Controlled, so refreshing after an action does not drop the user back on
  // the first tab — undoing a match happens on the Matched tab and they will
  // usually want to undo another.
  const [tab, setTab] = useState("match");
  const [pending, start] = useTransition();

  // default the selected bank once
  useEffect(() => {
    if (!selectedBank && accounts.length) setSelectedBank(accounts[0]);
  }, [accounts, selectedBank, setSelectedBank]);

  const load = useCallback(async () => {
    if (!selectedBank) return;
    const range = {
      bankAccountId: selectedBank.id,
      dateFrom: dateRange.from || undefined,
      dateTo: dateRange.to || undefined,
    };
    const [data, entries, matched] = await Promise.all([
      loadReconcileData(range),
      loadReconcileLog(selectedBank.id),
      loadAllocations(range),
    ]);
    setTxns((data.txns as Txn[]) ?? []);
    setPayments((data.payments as Payment[]) ?? []);
    setOlder(data.older);
    setLog(entries);
    setAllocs(matched);
  }, [selectedBank, dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  // A line that is gone (or now settled) must not stay selected or ticked.
  useEffect(() => {
    setSelectedTxn((cur) => (cur && txns.some((t) => t.id === cur.id) ? cur : null));
    setPicked((cur) => new Set([...cur].filter((id) => txns.some((t) => t.id === id))));
  }, [txns]);

  // The workbench owns everything it shows and reloads it here, and the
  // server actions already revalidate the route for the next navigation. A
  // router.refresh() on top of that only remounts the tree — which threw the
  // user back to the first tab after every match and every undo.
  const after = async (message: string) => {
    setNote(message);
    setAmounts({});
    await load();
  };

  function doMatch(p: Payment) {
    if (!selectedTxn || !selectedBank) return;
    const typed = Number(amounts[p.id]);
    const amount = Number.isFinite(typed) && typed > 0 ? typed : allocatable(selectedTxn, p);
    start(async () => {
      const res = await reconcile(selectedTxn.id, p.id, selectedBank.id, amount);
      if (res.ok) {
        setSelectedTxn(null);
        await after(`${tr(locale, "Allocated")} ${money(amount)}`);
      } else {
        setNote(res.error);
      }
    });
  }

  function createVoucher() {
    if (!selectedTxn || !selectedBank) return;
    start(async () => {
      const res = await createVoucherAndReconcile({
        txnId: selectedTxn.id,
        accountId: selectedBank.id,
        partyName: voucherParty || undefined,
      });
      if (res.ok) {
        setSelectedTxn(null);
        setVoucherParty("");
        await after(tr(locale, "Payment created and reconciled"));
      } else {
        setNote(res.error);
      }
    });
  }

  function autoMatch(only?: string[]) {
    if (!selectedBank) return;
    start(async () => {
      const res = await applyRulesForAccount(selectedBank.id, only);
      if (res.ok) await after(`${tr(locale, "Rules matched")} ${res.matched}`);
    });
  }

  function undo(a: Allocation) {
    if (!selectedBank) return;
    start(async () => {
      const res = await unallocate(a.alloc_id);
      if (res.ok) await after(`${tr(locale, "Match undone")} — ${money(a.allocated)}`);
      else setNote(res.error);
    });
  }

  function vouchersForPicked() {
    if (!selectedBank || picked.size === 0) return;
    const ids = [...picked];
    start(async () => {
      const res = await createVouchersForTransactions(ids, selectedBank.id);
      setPicked(new Set());
      await after(
        res.failed.length
          ? `${tr(locale, "Payments created")} ${res.done} — ${tr(locale, "failed")} ${res.failed.length}`
          : `${tr(locale, "Payments created")} ${res.done}`
      );
    });
  }

  const unreconciledAmount = txns.reduce((s, t) => s + Number(t.unallocated_amount), 0);
  const pickedTotal = txns
    .filter((t) => picked.has(t.id))
    .reduce((s, t) => s + Number(t.unallocated_amount), 0);

  // Candidates are ordered by how well they fit the selected line, so the
  // one to click is at the top instead of somewhere down a long list.
  const ranked = useMemo(() => {
    if (!selectedTxn) return payments.map((p) => ({ p, q: "none" as Quality }));
    const rank = { full: 0, partial: 1, none: 2 };
    return payments
      .map((p) => ({ p, q: quality(selectedTxn, p) }))
      .sort((a, b) => {
        if (rank[a.q] !== rank[b.q]) return rank[a.q] - rank[b.q];
        const da = Math.abs(Number(a.p.remaining) - Number(selectedTxn.unallocated_amount));
        const db = Math.abs(Number(b.p.remaining) - Number(selectedTxn.unallocated_amount));
        return da - db;
      });
  }, [payments, selectedTxn]);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-gray-5">
          <LandmarkIcon size={16} />
          <span className="font-medium text-ink-gray-8">{tr(locale, "Bank Reconciliation")}</span>
          <Badge theme="violet" variant="subtle">{tr(locale, "Beta")}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBank?.id ?? ""}
            onChange={(e) =>
              setSelectedBank(accounts.find((a) => a.id === e.target.value) ?? null)
            }
            className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} — {a.bank}</option>
            ))}
          </select>
          <input
            type="date" lang="en-CA"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="rounded-md border border-outline-gray-2 px-2 py-1.5 text-sm"
          />
          <input
            type="date" lang="en-CA"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="rounded-md border border-outline-gray-2 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {note && (
        <div className="rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-4 py-2 text-sm text-ink-gray-7">
          {note}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="match"><ShuffleIcon size={14} className="mr-1" /> {tr(locale, "Match & Reconcile")}</TabsTrigger>
          <TabsTrigger value="matched"><LinkIcon size={14} className="mr-1" /> {tr(locale, "Matched")}</TabsTrigger>
          <TabsTrigger value="statement"><ScrollTextIcon size={14} className="mr-1" /> {tr(locale, "Statement")}</TabsTrigger>
          <TabsTrigger value="log"><ListIcon size={14} className="mr-1" /> {tr(locale, "Action Log")}</TabsTrigger>
        </TabsList>

        {/* Match & Reconcile */}
        <TabsContent value="match" className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-ink-gray-5">
              {tr(locale, "Select a bank line, then match a payment.")}{" "}
              {tr(locale, "Unreconciled:")}{" "}
              <span className="font-semibold text-amber-600">{money(unreconciledAmount)}</span>
            </p>
            <Button variant="subtle" size="sm" onClick={() => autoMatch()} disabled={pending}>
              {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
              {tr(locale, "Auto-match by rules")}
            </Button>
          </div>

          {/* Lines older than the window being viewed are otherwise invisible. */}
          {older.n > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm">
              <ClockAlertIcon size={16} className="text-amber-600" />
              <span className="text-ink-gray-7">
                {tr(locale, "Older unreconciled lines outside this period:")}{" "}
                <span className="font-semibold">{older.n}</span>{" "}
                <span className="text-ink-gray-5">({money(older.total)})</span>
              </span>
              <button
                onClick={() => setDateRange({ ...dateRange, from: "" })}
                className="text-xs font-medium text-brand hover:underline"
              >
                {tr(locale, "Show them")}
              </button>
            </div>
          )}

          {/* Several lines at once, for a month-end batch. */}
          {picked.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand/40 bg-blue-50 px-4 py-2.5 text-sm">
              <span className="text-ink-gray-7">
                {tr(locale, "Selected lines:")} <span className="font-semibold">{picked.size}</span>{" "}
                <span className="text-ink-gray-5">({money(pickedTotal)})</span>
              </span>
              <Button variant="subtle" size="sm" onClick={() => autoMatch([...picked])} disabled={pending}>
                {tr(locale, "Auto-match the selected")}
              </Button>
              <Button variant="subtle" size="sm" onClick={vouchersForPicked} disabled={pending}>
                {tr(locale, "Create a payment for each")}
              </Button>
              <button onClick={() => setPicked(new Set())} className="text-xs text-ink-gray-5 hover:underline">
                {tr(locale, "clear")}
              </button>
            </div>
          )}

          {selectedTxn && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand/40 bg-blue-50 px-4 py-3 text-sm">
              <span className="text-ink-gray-5">{tr(locale, "Selected line:")}</span>
              <span className="font-medium text-ink-gray-8">
                {selectedTxn.description ?? selectedTxn.reference_number ?? selectedTxn.date} ·{" "}
                {money(selectedTxn.unallocated_amount)}
              </span>
              <span className="text-ink-gray-5">{tr(locale, "— no matching payment?")}</span>
              <input
                value={voucherParty}
                onChange={(e) => setVoucherParty(e.target.value)}
                placeholder={tr(locale, "party name (optional)")}
                className="rounded-md border border-outline-gray-2 px-2 py-1 text-sm"
              />
              <Button variant="subtle" size="sm" onClick={createVoucher} disabled={pending}>
                {tr(locale, "Create payment & reconcile")}
              </Button>
              <button onClick={() => setSelectedTxn(null)} className="text-xs text-ink-gray-5 hover:underline">
                {tr(locale, "clear")}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{tr(locale, "Unreconciled transactions")} ({txns.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-outline-gray-1">
                  {txns.length === 0 && (
                    <li className="flex items-center gap-2 px-4 py-6 text-sm text-emerald-600">
                      <CheckCircleIcon size={16} /> {tr(locale, "All reconciled")}
                    </li>
                  )}
                  {txns.map((t) => {
                    const part = Number(t.unallocated_amount) < Number(t.deposit) + Number(t.withdrawal) - EPS;
                    return (
                      <li key={t.id} className="flex items-center gap-2 ps-3">
                        <input
                          type="checkbox"
                          checked={picked.has(t.id)}
                          onChange={() => toggle(t.id)}
                          aria-label={tr(locale, "select this line")}
                          className="h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <button
                          onClick={() => setSelectedTxn(t)}
                          className={`flex w-full items-center justify-between px-2 py-3 text-left text-sm hover:bg-surface-gray-1 ${
                            selectedTxn?.id === t.id ? "bg-blue-50 ring-1 ring-inset ring-brand" : ""
                          }`}
                        >
                          <div>
                            <div className="font-medium text-ink-gray-8">{t.description ?? "—"}</div>
                            <div className="flex items-center gap-2 text-xs text-ink-gray-5">
                              <span>{t.date} · {t.reference_number ?? tr(locale, "no ref")}</span>
                              {part && (
                                <Badge theme="orange" variant="subtle">
                                  {tr(locale, "partly allocated")}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={t.deposit > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                              {t.deposit > 0 ? "+" : "-"}{money(t.deposit || t.withdrawal)}
                            </div>
                            {part && (
                              <div className="text-xs text-ink-gray-5">
                                {tr(locale, "left")} {money(t.unallocated_amount)}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{tr(locale, "Open payments")} ({payments.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-outline-gray-1">
                  {payments.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-ink-gray-5">{tr(locale, "No open payments")}</li>
                  )}
                  {ranked.map(({ p, q }) => {
                    const canTake = selectedTxn ? allocatable(selectedTxn, p) : 0;
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                          q === "full" ? "bg-emerald-50" : q === "partial" ? "bg-amber-50" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink-gray-8">{p.party_name ?? "—"}</span>
                            <span className="text-xs text-ink-gray-5">({p.payment_type})</span>
                            {selectedTxn && (
                              <Badge
                                theme={q === "full" ? "green" : q === "partial" ? "orange" : "gray"}
                                variant="subtle"
                              >
                                {tr(locale, q === "full" ? "exact match" : q === "partial" ? "partial match" : "no match")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-ink-gray-5">
                            {p.posting_date} · {p.reference_no ?? tr(locale, "no ref")}
                            {Number(p.allocated) > EPS && (
                              <> · {tr(locale, "left")} {money(p.remaining)}</>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {selectedTxn && q === "partial" && (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={amounts[p.id] ?? String(canTake)}
                              onChange={(e) => setAmounts({ ...amounts, [p.id]: e.target.value })}
                              aria-label={tr(locale, "amount to allocate")}
                              className="w-28 rounded-md border border-outline-gray-2 px-2 py-1 text-sm"
                            />
                          )}
                          <span className="font-semibold">{money(p.remaining)}</span>
                          <Button
                            variant="solid"
                            size="sm"
                            disabled={!selectedTxn || pending || q === "none"}
                            onClick={() => doMatch(p)}
                          >
                            {tr(locale, "Match")}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* What is already matched — and how to undo it */}
        <TabsContent value="matched" className="pt-4">
          <Card>
            <CardHeader><CardTitle>{tr(locale, "Matched")} ({allocs.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-outline-gray-1">
                {allocs.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-ink-gray-5">
                    {tr(locale, "Nothing matched in this period")}
                  </li>
                )}
                {allocs.map((a) => (
                  <li key={a.alloc_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink-gray-8">
                          {a.txn_description ?? a.txn_reference ?? a.txn_date}
                        </span>
                        <span className="text-ink-gray-4">←</span>
                        <span className="truncate text-ink-gray-7">{a.party_name ?? "—"}</span>
                        {Number(a.txn_unallocated) > EPS && (
                          <Badge theme="orange" variant="subtle">{tr(locale, "partly allocated")}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-ink-gray-5">
                        {a.txn_date} · {a.payment_reference ?? a.txn_reference ?? tr(locale, "no ref")}
                        {Number(a.txn_unallocated) > EPS && (
                          <> · {tr(locale, "left")} {money(a.txn_unallocated)}</>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold">{money(a.allocated)}</span>
                      <Button variant="subtle" size="sm" disabled={pending} onClick={() => undo(a)}>
                        <Link2OffIcon size={14} className="mr-1" />
                        {tr(locale, "Undo match")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statement */}
        <TabsContent value="statement" className="pt-4">
          <Card>
            <CardHeader><CardTitle>{tr(locale, "Reconciliation statement")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-center gap-3">
                <span className="w-56 text-ink-gray-5">{tr(locale, "Closing balance as per bank statement")}</span>
                <input type="number" value={closing} onChange={(e) => setClosing(Number(e.target.value))}
                  className="w-40 rounded-md border border-outline-gray-2 px-2 py-1.5 text-sm" />
              </label>
              <div className="flex justify-between border-t border-outline-gray-1 pt-2">
                <span className="text-ink-gray-5">{tr(locale, "Unreconciled amount")}</span>
                <span className="font-semibold text-amber-600">{money(unreconciledAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-gray-5">{tr(locale, "Difference (closing − unreconciled)")}</span>
                <span className="font-semibold">{money(closing - unreconciledAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action log */}
        <TabsContent value="log" className="pt-4">
          <Card>
            <CardHeader><CardTitle>{tr(locale, "Action log")} ({log.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-outline-gray-1">
                {log.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-gray-5">{tr(locale, "No actions yet")}</li>}
                {log.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {l.detail}
                      {l.actor ? (
                        <span className="ms-2 text-xs text-ink-gray-5">{l.actor}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-gray-5">
                      <Badge theme={l.action === "unmatch" ? "red" : "green"} variant="subtle">
                        {tr(locale, l.action === "unmatch" ? "unmatched" : "matched")}
                      </Badge>
                      {new Date(l.at).toLocaleString("en-US", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit", hour12: false,
                      })}
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
