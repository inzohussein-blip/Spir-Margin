"use client";

import { useState } from "react";
import { ShoppingCartIcon, FlaskConicalIcon, PackageIcon, FileTextIcon, ReceiptIcon, LockIcon, RefreshCwIcon, PlusIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import { localDate } from "@/lib/dates";
import { useLocalQuery, useRuntime } from "./hooks";
import { Card, Pager, SearchBox, Table, PAGE, fmtMoney, fmtDate } from "./parts";

/**
 * The web app's screens so far: the stations, and the sales station's daily
 * work — the point of sale, recent sales, labs, products and invoices — all
 * on the database in this browser. The other stations run on the installed
 * version and come here one by one.
 */

/** Which stations the web app already has, and their pages. */
export const LOCAL_PAGES: Record<string, { href: string; label: string; icon: typeof ShoppingCartIcon }[]> = {
  sales: [
    { href: "#/pos", label: "Point of Sale", icon: ShoppingCartIcon },
    { href: "#/sales", label: "Recent sales", icon: ReceiptIcon },
    { href: "#/labs", label: "Labs", icon: FlaskConicalIcon },
    { href: "#/products", label: "Products", icon: PackageIcon },
    { href: "#/invoices", label: "Sales Invoices", icon: FileTextIcon },
  ],
};

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
          const pages = LOCAL_PAGES[s.id];
          const closed = mods.length > 0 && !mods.includes(s.id);
          return (
            <div key={s.id} data-local-station={s.id} className={`rounded-2xl border-2 bg-surface-white p-4 ${s.tone.ring} ${closed || !pages ? "opacity-70" : ""}`}>
              <div className="font-bold text-ink-gray-9">{T(s.label)}</div>
              {closed ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-ink-gray-5"><LockIcon size={12} /> {T("Not in your code")}</p>
              ) : pages ? (
                <ul className="mt-3 space-y-1.5">
                  {pages.map((p) => {
                    const Icon = p.icon;
                    return <li key={p.href}><a href={p.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-gray-7 hover:bg-surface-gray-1"><Icon size={15} className="text-brand" /> {T(p.label)}</a></li>;
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-ink-gray-5">{T("In the installed version now; coming to the web app.")}</p>
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

export function Labs() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const l = useList();
  const { data, count } = useLocalQuery<{ id: string; code: string; name: string; city: string | null; phone: string | null; status: string }[]>(
    (c) => c.from("labs").select("id, code, name, city, phone, status", { count: "exact" }).search(["code", "name", "city", "phone"], l.q).order("name").range(l.from, l.to),
    [l.q, l.page]);
  return (
    <Card title={`${T("Labs")} (${count})`} actions={
      <div className="flex items-center gap-2">
        <SearchBox value={l.q} onChange={l.setQ} />
        <a href="#/labs/new" className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"><PlusIcon size={14} /> {T("New lab")}</a>
      </div>
    }>
      <div data-testid="local-labs">
        <Table head={[T("Code"), T("Name"), T("City"), T("Phone")]} empty={T("No labs yet")}
          rows={(data ?? []).map((r) => [<span key="c" className="font-medium">{r.code}</span>, r.name, r.city ?? "—", <span key="p" dir="ltr">{r.phone ?? "—"}</span>])} />
      </div>
      <Pager page={l.page} total={count} onPage={l.setPage} />
    </Card>
  );
}

export function LabNew({ go }: { go: (to: string) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cls = "w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-sm outline-none focus:border-brand";
  return (
    <Card title={T("New lab")}>
      <form data-testid="local-lab-form" className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const row = Object.fromEntries(["code", "name", "city", "phone", "contact_name"].map((k) => [k, String(fd.get(k) ?? "").trim() || null]));
        if (!row.code || !row.name) { setErr(T("Enter the code and the name")); return; }
        setBusy(true); setErr("");
        const { error } = await rt.client!.from("labs").insert(row);
        setBusy(false);
        if (error) setErr(error.message);
        else go("/labs");
      }}>
        {[["code", "Code"], ["name", "Name"], ["city", "City"], ["phone", "Phone"], ["contact_name", "Contact"]].map(([k, label]) => (
          <label key={k} className="block"><span className="text-xs text-ink-gray-5">{T(label)}</span><input name={k} className={cls} dir={k === "phone" || k === "code" ? "ltr" : undefined} /></label>
        ))}
        <div className="flex items-center gap-2 sm:col-span-2">
          <button disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{T("Save")}</button>
          <a href="#/labs" className="rounded-lg border border-outline-gray-2 px-4 py-2 text-sm">{T("Cancel")}</a>
          {err && <span role="alert" className="text-sm text-red-600">{err}</span>}
        </div>
      </form>
    </Card>
  );
}

export function Products() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const l = useList();
  const { data, count } = useLocalQuery<{ id: string; item_code: string; name: string; product_type: string; default_sell_price: number }[]>(
    (c) => c.from("products").select("id, item_code, name, product_type, default_sell_price", { count: "exact" }).search(["item_code", "name", "brand"], l.q).order("name").range(l.from, l.to),
    [l.q, l.page]);
  return (
    <Card title={`${T("Products")} (${count})`} actions={<SearchBox value={l.q} onChange={l.setQ} />}>
      <Table head={[T("Code"), T("Name"), T("Type"), T("Sell price")]} empty={T("No products yet")}
        rows={(data ?? []).map((r) => [<span key="c" dir="ltr">{r.item_code}</span>, r.name, T(r.product_type === "kit" ? "Kit" : r.product_type === "device" ? "Device" : "Spare part"), <span key="p" className="tabular-nums">{fmtMoney(r.default_sell_price)}</span>])} />
      <Pager page={l.page} total={count} onPage={l.setPage} />
    </Card>
  );
}

export function Invoices() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const l = useList();
  const { data, count } = useLocalQuery<{ id: string; invoice_no: string; posting_date: string; status: string; total_amount: number; outstanding: number; labs: { name: string } | null }[]>(
    (c) => c.from("sales_invoices").select("id, invoice_no, posting_date, status, total_amount, outstanding, labs(name)", { count: "exact" }).search(["invoice_no"], l.q).order("posting_date", { ascending: false }).range(l.from, l.to),
    [l.q, l.page]);
  return (
    <Card title={`${T("Sales Invoices")} (${count})`} actions={<SearchBox value={l.q} onChange={l.setQ} placeholder={T("Invoice no.")} />}>
      <Table head={[T("Invoice"), T("Date"), T("Lab"), T("Total"), T("Outstanding")]} empty={T("No invoices yet")}
        rows={(data ?? []).map((r) => [
          <a key="n" href={`#/invoices/${r.id}`} className="font-medium text-brand hover:underline" dir="ltr">{r.invoice_no}</a>,
          <span key="d" dir="ltr">{fmtDate(r.posting_date)}</span>, r.labs?.name ?? "—",
          <span key="t" className="tabular-nums">{fmtMoney(r.total_amount)}</span>, <span key="o" className="tabular-nums">{fmtMoney(r.outstanding)}</span>,
        ])} />
      <Pager page={l.page} total={count} onPage={l.setPage} />
    </Card>
  );
}

export function InvoiceDetail({ id }: { id: string }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const { data } = useLocalQuery<{ invoice_no: string; posting_date: string; status: string; total_amount: number; outstanding: number; labs: { name: string } | null; sales_invoice_items: { qty: number; rate: number; amount: number; products: { name: string } | null }[] }>(
    (c) => c.from("sales_invoices").select("invoice_no, posting_date, status, total_amount, outstanding, labs(name), sales_invoice_items(qty, rate, amount, products(name))").eq("id", id).single(), [id]);
  if (!data) return <p className="text-sm text-ink-gray-5">{T("Loading…")}</p>;
  return (
    <Card title={<span dir="ltr">{data.invoice_no}</span>} actions={<a href="#/invoices" className="text-sm text-brand">{T("Back")}</a>}>
      <div className="grid gap-2 p-4 text-sm sm:grid-cols-3">
        <div><span className="text-ink-gray-5">{T("Lab")}: </span>{data.labs?.name ?? "—"}</div>
        <div><span className="text-ink-gray-5">{T("Date")}: </span><span dir="ltr">{fmtDate(data.posting_date)}</span></div>
        <div><span className="text-ink-gray-5">{T("Outstanding")}: </span><span className="tabular-nums">{fmtMoney(data.outstanding)}</span></div>
      </div>
      <Table head={[T("Product"), T("Qty"), T("Rate"), T("Amount")]} empty="—"
        rows={(data.sales_invoice_items ?? []).map((it) => [it.products?.name ?? "—", <span key="q" className="tabular-nums">{Number(it.qty)}</span>, <span key="r" className="tabular-nums">{fmtMoney(it.rate)}</span>, <span key="a" className="tabular-nums">{fmtMoney(it.amount)}</span>])} />
      <div className="border-t border-outline-gray-1 px-4 py-3 text-end text-sm font-semibold">{T("Total")}: <span className="tabular-nums">{fmtMoney(data.total_amount)}</span></div>
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
