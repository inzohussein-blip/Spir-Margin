"use client";

import { useEffect, useState } from "react";
import { ListIcon, LockIcon, RefreshCwIcon, ShoppingCartIcon } from "lucide-react";
import { APP_EVENT, APP_READY_KEY, checkForUpdate } from "./AppInstall";
import { ThemeSwitch } from "./theme";
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
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-4">
          <div className="text-xs text-ink-gray-5">{T("Sales today")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink-gray-9" data-testid="sales-today">{data ? n : "—"}</div>
        </div>
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-4">
          <div className="text-xs text-ink-gray-5">{T("Revenue today")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-ink-gray-9">{data ? fmtMoney(total) : "—"}</div>
        </div>
        <a href="#/pos" className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-sm hover:opacity-95">
          <span className="font-bold">{T("Point of Sale")}</span><ShoppingCartIcon size={22} />
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STATIONS.map((s) => {
          const pages = stationPages(s.id);
          const closed = mods.length > 0 && !mods.includes(s.id);
          const body = (
            <>
              <div className="flex items-center gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${s.tone.icon} text-white shadow-sm`}>
                  {(() => { const Icon = ICONS[pages[0]?.icon ?? "list"] ?? ListIcon; return <Icon size={19} />; })()}
                </span>
                <div className="font-bold text-ink-gray-9">{T(s.label)}</div>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-gray-6">{T(s.desc)}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                {closed ? <span className="flex items-center gap-1 text-ink-gray-5"><LockIcon size={12} /> {T("Not in your code")}</span>
                  : <><span className="text-ink-gray-5"><span className="tabular-nums">{pages.length}</span> {T("pages")}</span><span className={`rounded-lg px-3 py-1.5 font-semibold text-white ${s.tone.button}`}>{T("Go in")}</span></>}
              </div>
            </>
          );
          const cls = `flex flex-col rounded-2xl border-2 bg-surface-white p-4 shadow-sm transition-colors ${s.tone.ring}`;
          return closed
            ? <div key={s.id} data-local-station={s.id} data-closed="1" className={`${cls} opacity-60 grayscale`}>{body}</div>
            : <a key={s.id} href={`#/s/${s.id}`} data-local-station={s.id} className={cls}>{body}</a>;
        })}
      </div>
    </div>
  );
}

/** A station's own home: its pages as tiles, in its colours. */
export function StationHome({ id }: { id: string }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const s = STATIONS.find((x) => x.id === id);
  if (!s) return null;
  return (
    <div className="space-y-5" data-testid={`station-${id}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${s.tone.icon} text-white shadow-sm`}>
          {(() => { const Icon = ICONS[stationPages(id)[0]?.icon ?? "list"] ?? ListIcon; return <Icon size={22} />; })()}
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink-gray-9">{T(s.label)}</h1>
          <p className="text-sm text-ink-gray-6">{T(s.desc)}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stationPages(id).map((p) => {
          const Icon = ICONS[p.icon] ?? ListIcon;
          return (
            <a key={p.href} href={p.href} className={`flex items-center gap-3 rounded-2xl border-2 bg-surface-white p-4 shadow-sm ${s.tone.ring}`}>
              <span className={`grid size-10 place-items-center rounded-xl ${s.tone.soft}`}><Icon size={19} /></span>
              <span className="font-semibold text-ink-gray-8">{T(p.label)}</span>
            </a>
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

/** This device: its sync with the company, the app saved for offline use, its storage, its look. */
export function DevicePage() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["sync", "license"]);
  const l = rt.license;
  const s = rt.sync;
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const [store, setStore] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const read = () => { try { setReadyAt(Number(localStorage.getItem(APP_READY_KEY)) || null); } catch { setReadyAt(null); } };
    read();
    window.addEventListener(APP_EVENT, read);
    void (async () => {
      try {
        const e = await navigator.storage?.estimate?.();
        const persisted = (await navigator.storage?.persisted?.()) ?? false;
        if (e?.quota) setStore({ usage: e.usage ?? 0, quota: e.quota, persisted });
      } catch { /* unsupported */ }
    })();
    return () => window.removeEventListener(APP_EVENT, read);
  }, []);
  const mb = (n: number) => `${(n / 1_048_576).toLocaleString("en-US", { maximumFractionDigits: n < 10_485_760 ? 1 : 0 })} MB`;
  const row = (k: string, v: React.ReactNode, testid?: string) => <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-gray-5">{T(k)}</dt><dd className="text-end" data-testid={testid}>{v}</dd></div>;
  const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-CA", { hour12: false }).replace(",", "") : "—");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={T("Sync")} actions={
        <button onClick={() => void rt.syncNow()} disabled={s.running || !l?.cloud} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          <RefreshCwIcon size={14} className={s.running ? "animate-spin" : ""} /> {T("Sync now")}
        </button>}>
        <dl className="divide-y divide-outline-gray-1 px-4 py-2 text-sm" data-testid="local-sync-info">
          {row("Company database", l?.cloud ? T("Linked — syncs through the site") : T("Not linked: the records stay on this browser"))}
          {row("Last sync", <span dir="ltr">{when(s.lastAt)}</span>)}
          {row("Waiting to be sent", <span className="tabular-nums" data-pending={s.pending}>{s.pending}</span>)}
          {row("Last pass", `${T("sent")} ${s.pushed} · ${T("brought")} ${s.pulled}`)}
          {s.error && row("Last error", <span className="text-red-600" dir="auto">{s.error === "offline" ? T("Without internet") : s.error}</span>)}
        </dl>
      </Card>
      <Card title={T("The app on this browser")} actions={
        <button disabled={checking} onClick={async () => { setChecking(true); await checkForUpdate(); setTimeout(() => setChecking(false), 1500); }}
          className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm disabled:opacity-50">
          <RefreshCwIcon size={14} className={checking ? "animate-spin" : ""} /> {T("Check for a new version")}
        </button>}>
        <dl className="divide-y divide-outline-gray-1 px-4 py-2 text-sm">
          {row("Works without the internet", readyAt ? <span className="text-emerald-700">{T("Yes")}</span> : <span className="text-amber-700">{T("Not yet — it is saved on the first open with the internet")}</span>, "offline-ready")}
          {row("Saved copy updated", <span dir="ltr">{when(readyAt)}</span>)}
          {row("Space used", store ? <span dir="ltr" className="tabular-nums">{mb(store.usage)} / {mb(store.quota)}</span> : "—")}
          {row("Kept when the disk runs low", store ? (store.persisted ? T("Yes") : T("Up to the browser")) : "—")}
        </dl>
        <p className="border-t border-outline-gray-1 px-4 py-3 text-xs leading-relaxed text-ink-gray-5">
          {T("The records live in this browser. Do not clear this site's data before the last changes are sent.")}
        </p>
      </Card>
      <Card title={T("Appearance")}>
        <div className="p-4"><ThemeSwitch /></div>
      </Card>
    </div>
  );
}
