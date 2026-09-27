import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getBranding } from "@/lib/branding";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { PrintButton } from "@/components/print/PrintButton";
import { barcodeSvg } from "@/lib/barcode/code128";

export const dynamic = "force-dynamic";

type Kind = "products" | "batches" | "serials";
interface Item { id: string; code: string; title: string; extra?: string | null }

const KINDS: [Kind, string][] = [["products", "Products"], ["batches", "Kit batches"], ["serials", "Serials"]];

async function items(kind: Kind, q: string): Promise<Item[]> {
  const supabase = createClient();
  if (kind === "batches") {
    let s = supabase.from("kit_batches").select("id, batch_no, expiry_date, products(name)").order("expiry_date", { ascending: true }).limit(300);
    if (q) s = s.ilike("batch_no", `%${q}%`);
    const { data } = await s;
    return ((data as { id: string; batch_no: string; expiry_date: string | null; products: { name: string } | null }[] | null) ?? [])
      .map((b) => ({ id: b.id, code: b.batch_no, title: b.products?.name ?? "", extra: b.expiry_date ? String(b.expiry_date).slice(0, 10) : null }));
  }
  if (kind === "serials") {
    let s = supabase.from("serial_numbers").select("id, serial_no, products(name)").order("serial_no").limit(300);
    if (q) s = s.ilike("serial_no", `%${q}%`);
    const { data } = await s;
    return ((data as { id: string; serial_no: string; products: { name: string } | null }[] | null) ?? [])
      .map((x) => ({ id: x.id, code: x.serial_no, title: x.products?.name ?? "" }));
  }
  let s = supabase.from("products").select("id, item_code, name").eq("is_disabled", false).order("name").limit(300);
  if (q) s = s.ilike("name", `%${q}%`);
  const { data } = await s;
  return ((data as { id: string; item_code: string; name: string }[] | null) ?? []).map((p) => ({ id: p.id, code: p.item_code, title: p.name }));
}

/**
 * Barcode labels (Code 128) for products, kit batches and serial numbers —
 * pick them, choose how many of each, print. A scanner at the point of sale
 * reads them back (POS: the code + Enter).
 */
export default async function LabelsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const locale = getLocale();
  const kind = (KINDS.some(([k]) => k === searchParams?.kind) ? searchParams?.kind : "products") as Kind;
  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const picked = new Set([searchParams?.id ?? []].flat().map(String));
  const copies = Math.min(50, Math.max(1, Number(searchParams?.copies) || 1));
  const list = await items(kind, q);

  if (searchParams?.print === "1" && picked.size) {
    const brand = await getBranding();
    const chosen = list.filter((i) => picked.has(i.id));
    const labels = chosen.flatMap((i) => Array.from({ length: copies }, (_, n) => ({ ...i, n })));
    const back = `/labels?kind=${kind}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    return (
      <div className="space-y-4">
        <div className="no-print flex items-center justify-between">
          <Link href={back} className="text-sm text-ink-gray-5 hover:text-brand"><span aria-hidden>→</span> {t(locale, "Back")}</Link>
          <PrintButton />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3 print:gap-1" data-testid="label-sheet">
          {labels.map((l) => {
            const svg = barcodeSvg(l.code, 40);
            return (
              <div key={`${l.id}-${l.n}`} className="flex h-36 flex-col justify-between overflow-hidden rounded-md border border-outline-gray-2 bg-white p-2 text-black print:h-[36mm] print:rounded-none print:border-dashed" data-label={l.code}>
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="truncate font-semibold">{brand.companyName || "Spir-Margin"}</span>
                  {l.extra && <span className="shrink-0 tabular-nums" dir="ltr">EXP {l.extra}</span>}
                </div>
                <div className="truncate text-xs font-medium" dir="auto">{l.title}</div>
                {svg ? <div className="h-12 w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="text-[10px] text-red-600">{t(locale, "This code cannot be printed as a barcode")}</div>}
                <div className="text-center font-mono text-[11px] tracking-wider" dir="ltr">{l.code}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Barcode labels")}</h1>
      <nav className="flex gap-1 text-sm">
        {KINDS.map(([k, label]) => (
          <Link key={k} href={`/labels?kind=${k}`} aria-current={k === kind ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-medium ${k === kind ? "bg-brand text-white" : "text-ink-gray-6 hover:bg-surface-gray-2"}`}>{t(locale, label)}</Link>
        ))}
      </nav>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input name="q" defaultValue={q} placeholder={t(locale, "Search")} className="w-64 rounded-lg border border-outline-gray-2 px-3 py-2 text-sm" />
        <button className="rounded-lg border border-outline-gray-2 px-3 py-2 text-sm hover:bg-surface-gray-1">{t(locale, "Search")}</button>
      </form>
      <Panel title={`${t(locale, "Choose what to label")} (${list.length})`}>
        {list.length === 0 ? <EmptyRow text={t(locale, "Nothing to label here yet")} /> : (
          <form method="get" className="space-y-3 p-2" data-testid="label-picker">
            <input type="hidden" name="kind" value={kind} />
            {q && <input type="hidden" name="q" value={q} />}
            <input type="hidden" name="print" value="1" />
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-outline-gray-1">
              {list.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-center gap-3 border-b border-outline-gray-1 px-3 py-2 text-sm last:border-0 hover:bg-surface-gray-1">
                  <input type="checkbox" name="id" value={i.id} defaultChecked={picked.has(i.id)} className="size-4" />
                  <span className="flex-1">{i.title}</span>
                  <span className="font-mono text-xs text-ink-gray-5" dir="ltr">{i.code}</span>
                  {i.extra && <span className="text-xs tabular-nums text-ink-gray-5" dir="ltr">{i.extra}</span>}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">{t(locale, "Copies of each")}
                <input name="copies" type="number" min="1" max="50" defaultValue={copies} className="ms-2 w-20 rounded-md border border-outline-gray-2 px-2 py-1" dir="ltr" />
              </label>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{t(locale, "Prepare the labels")}</button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
