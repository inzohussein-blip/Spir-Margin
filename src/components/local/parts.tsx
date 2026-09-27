"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RefreshCwIcon, CloudOffIcon, CheckCircle2Icon, AlertTriangleIcon, CloudUploadIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { useRuntime } from "./hooks";

export const PAGE = 50;
export const fmtMoney = (n: unknown) => Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const fmtDate = (v: unknown) => (v ? String(v).slice(0, 10) : "—");

/** Where this browser's records stand with the company's database. */
export function SyncChip() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["sync", "license"]);
  const s = rt.sync;
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  if (!rt.license?.cloud) {
    return <span data-testid="local-sync" data-state="local" className="inline-flex items-center gap-1.5 rounded-full border border-outline-gray-2 px-2.5 py-1 text-xs text-ink-gray-6">{T("On this browser only")}</span>;
  }
  const state = s.running ? "running" : !online ? "offline" : s.error ? "error" : s.pending ? "pending" : "ok";
  const tone = { running: "border-sky-200 bg-sky-50 text-sky-700", offline: "border-amber-200 bg-amber-50 text-amber-800", error: "border-red-200 bg-red-50 text-red-700", pending: "border-brand/30 bg-brand-light text-brand", ok: "border-emerald-200 bg-emerald-50 text-emerald-700" }[state];
  const label = {
    running: T("Syncing…"),
    offline: `${T("Without internet")}${s.pending ? ` · ${s.pending} ${T("waiting")}` : ""}`,
    error: T("Sync error"),
    pending: `${s.pending} ${T("waiting")}`,
    ok: T("Synced"),
  }[state];
  const Icon = { running: RefreshCwIcon, offline: CloudOffIcon, error: AlertTriangleIcon, pending: CloudUploadIcon, ok: CheckCircle2Icon }[state];
  return (
    <button type="button" data-testid="local-sync" data-state={state} onClick={() => void rt.syncNow()} title={s.error ?? T("Sync now")}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      <Icon size={13} className={s.running ? "animate-spin" : ""} /> {label}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const locale = useLocale();
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    const id = setTimeout(() => { if (v !== value) onChange(v); }, 300);
    return () => clearTimeout(id);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} name="q" placeholder={placeholder ?? `${t(locale, "Search")}…`}
      className="w-full max-w-xs rounded-md border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm outline-none focus:border-brand" />
  );
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (total <= PAGE && page <= 1) return null;
  const first = total ? (page - 1) * PAGE + 1 : 0;
  const btn = "rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1 disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-outline-gray-1 px-4 py-3 text-sm text-ink-gray-5">
      <span>{T("Showing")} {first.toLocaleString("en-US")} {T("to")} {Math.min(page * PAGE, total).toLocaleString("en-US")} {T("of")} {total.toLocaleString("en-US")}</span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>{T("Previous")}</button>
        <span className="tabular-nums">{page} / {pages}</span>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>{T("Next")}</button>
      </div>
    </div>
  );
}

export function Card({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-gray-1 bg-surface-gray-1/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-gray-7">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="p-6 text-center text-sm text-ink-gray-5">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-start text-xs text-ink-gray-4">{head.map((h, i) => <th key={i} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-outline-gray-1">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
