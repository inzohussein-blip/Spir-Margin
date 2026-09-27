"use client";

import { useState } from "react";
import { ListIcon, LockIcon, RefreshCwIcon } from "lucide-react";
import { stationPages } from "@/lib/local/registry";
import { ICONS } from "./entity";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import { localDate } from "@/lib/dates";
import { useLocalQuery, useRuntime } from "./hooks";
import { Card, Pager, Table, PAGE, fmtMoney } from "./parts";

/**
 * The web app's home (today's sales, and every station with its pages), the
 * point of sale's recent sales, and where sync stands. The stations' lists
 * and records come from the registry (src/lib/local/registry.ts, entity.tsx).
 */

export function Home() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["license"]);
  const today = localDate();
  const { data } = useLocalQuery<{ qty: number; sell_price: number }[]>(
    (c) => c.from("sales").select("qty, sell_price").gte("sold_at", `${today}T00:00:00`), [today]);
  const n = data?.length ?? 0;
  const total = (data ?? []).reduce((s, r) => s + Number(r.qty) * Number(r.sell_price), 0);
  const mods = rt.license?.mods ?? [];
  return (
    <div className="space-y-6" data-testid="local-home">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-4">
          <div className="text-xs text-ink-gray-5">{T("Sales today")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink-gray-9" data-testid="sales-today">{data ? n : "—"}</div>
        </div>
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-4">
          <div className="text-xs text-ink-gray-5">{T("Revenue today")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink-gray-9">{data ? fmtMoney(total) : "—"}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STATIONS.map((s) => {
          const pages = stationPages(s.id);
          const closed = mods.length > 0 && !mods.includes(s.id);
          return (
            <div key={s.id} data-local-station={s.id} className={`rounded-2xl border-2 bg-surface-white p-4 ${s.tone.ring} ${closed ? "opacity-70" : ""}`}>
              <div className="font-bold text-ink-gray-9">{T(s.label)}</div>
              {closed ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-ink-gray-5"><LockIcon size={12} /> {T("Not in your code")}</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {pages.map((p) => {
                    const Icon = ICONS[p.icon] ?? ListIcon;
                    return <li key={p.href}><a href={p.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-gray-7 hover:bg-surface-gray-1"><Icon size={15} className="text-brand" /> {T(p.label)}</a></li>;
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useList() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  return { q, page, setPage, setQ: (v: string) => { setQ(v); setPage(1); }, from: (page - 1) * PAGE, to: page * PAGE - 1 };
}

export function Sales() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const l = useList();
  const { data, count } = useLocalQuery<{ id: string; qty: number; sell_price: number; sold_at: string; labs: { name: string } | null; products: { name: string } | null }[]>(
    (c) => c.from("sales").select("id, qty, sell_price, sold_at, labs(name), products(name)", { count: "exact" }).order("sold_at", { ascending: false }).range(l.from, l.to),
    [l.page]);
  return (
    <Card title={`${T("Recent sales")} (${count})`}>
      <Table head={[T("Date"), T("Lab"), T("Product"), T("Qty"), T("Total")]} empty={T("No sales yet")}
        rows={(data ?? []).map((r) => [
          <span key="d" dir="ltr" className="tabular-nums">{String(r.sold_at).slice(0, 16).replace("T", " ")}</span>,
          r.labs?.name ?? "—", r.products?.name ?? "—",
          <span key="q" className="tabular-nums">{Number(r.qty)}</span>,
          <span key="t" className="tabular-nums font-medium">{fmtMoney(Number(r.qty) * Number(r.sell_price))}</span>,
        ])} />
      <Pager page={l.page} total={count} onPage={l.setPage} />
    </Card>
  );
}

export function SyncInfo() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["sync", "license"]);
  const l = rt.license;
  const s = rt.sync;
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-gray-5">{T(k)}</dt><dd className="text-end">{v}</dd></div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={T("Sync")} actions={
        <button onClick={() => void rt.syncNow()} disabled={s.running || !l?.cloud} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          <RefreshCwIcon size={14} className={s.running ? "animate-spin" : ""} /> {T("Sync now")}
        </button>}>
        <dl className="divide-y divide-outline-gray-1 px-4 py-2 text-sm" data-testid="local-sync-info">
          {row("Company database", l?.cloud ? T("Linked — syncs through the site") : T("Not linked: the records stay on this browser"))}
          {row("Last sync", <span dir="ltr">{s.lastAt ? new Date(s.lastAt).toLocaleString("en-CA", { hour12: false }).replace(",", "") : "—"}</span>)}
          {row("Waiting to be sent", <span className="tabular-nums" data-pending={s.pending}>{s.pending}</span>)}
          {row("Last pass", `${T("sent")} ${s.pushed} · ${T("brought")} ${s.pulled}`)}
          {s.error && row("Last error", <span className="text-red-600" dir="auto">{s.error}</span>)}
        </dl>
      </Card>
      <Card title={T("Activation code")}>
        <dl className="divide-y divide-outline-gray-1 px-4 py-2 text-sm">
          {row("Company", l?.company ?? "—")}
          {row("until", <span dir="ltr">{l?.until ? new Date(l.until).toLocaleDateString("en-CA") : "—"}</span>)}
          {row("Stations", STATIONS.filter((st) => l?.mods.includes(st.id)).map((st) => T(st.label)).join("، ") || "—")}
          {row("This device", <span dir="ltr" className="font-mono text-xs">{l?.device.slice(0, 12)}</span>)}
        </dl>
      </Card>
    </div>
  );
}
