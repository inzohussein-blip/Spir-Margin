"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  SearchIcon, PlusIcon, MinusIcon, XIcon,
  ShoppingCartIcon, Loader2Icon, CheckCircle2Icon, ArrowLeftIcon, CloudOffIcon,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { useOffline } from "@/components/offline/OfflineProvider";
import { SyncStatus } from "@/components/offline/SyncStatus";
import { t } from "@/lib/i18n";
import { arabicIncludes, foldArabic } from "@/lib/text/arabic";
import { remember, recall } from "@/lib/remember";
import { KitHint } from "@/components/form/KitHint";

interface Product {
  id: string;
  item_code: string;
  name: string;
  product_type: string;
  default_buy_price: number;
  default_sell_price: number;
}
interface Lab { id: string; code: string; name: string; }
interface Line { product: Product; qty: number; sell: number; }

const TYPE_LABEL: Record<string, string> = { device: "جهاز", spare_part: "قطعة غيار", kit: "عدّة" };

export function PosTerminal({
  products, labs, iqdRate,
}: {
  products: Product[];
  labs: Lab[];
  iqdRate: number;
}) {
  const locale = useLocale();
  const { submitSale, online } = useOffline();
  const [labId, setLabId] = useState("");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [currency, setCurrency] = useState<"USD" | "IQD">("USD");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ count: number; total: number } | null>(null);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return products;
    return products.filter((p) => arabicIncludes(p.name, q) || arabicIncludes(p.item_code, q));
  }, [products, query]);

  // The last customer and currency used here come back next time.
  const recalled = useRef(false);
  useEffect(() => {
    const lab = recall("pos.lab");
    if (lab && labs.some((l) => l.id === lab)) setLabId(lab);
    const cur = recall("pos.currency");
    if (cur === "USD" || cur === "IQD") setCurrency(cur);
    recalled.current = true;
  }, [labs]);
  useEffect(() => {
    if (recalled.current) remember("pos.lab", labId);
  }, [labId]);
  useEffect(() => {
    if (recalled.current) remember("pos.currency", currency);
  }, [currency]);

  /**
   * Enter in the search box: a barcode scanner types the code and presses
   * Enter, so an exact code adds that product at once; so does a search
   * that leaves exactly one product.
   */
  function onSearchEnter() {
    const q = foldArabic(query.trim());
    if (!q) return;
    const exact = products.find((p) => foldArabic(p.item_code) === q);
    const pick = exact ?? (filtered.length === 1 ? filtered[0] : null);
    if (pick) {
      addProduct(pick);
      setQuery("");
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.sell, 0);
  const cost = cart.reduce((s, l) => s + l.qty * Number(l.product.default_buy_price), 0);
  const profit = subtotal - cost;
  const rate = currency === "IQD" ? iqdRate : 1;
  const sym = currency === "IQD" ? "د.ع" : "$";
  const fmt = (n: number) =>
    `${sym} ${(n * rate).toLocaleString("en-US", { maximumFractionDigits: currency === "IQD" ? 0 : 2 })}`;

  function addProduct(p: Product) {
    setDone(null);
    setQueued(false);
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i >= 0) {
        const next = [...c];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...c, { product: p, qty: 1, sell: Number(p.default_sell_price) }];
    });
  }
  const setQty = (id: string, qty: number) =>
    setCart((c) => c.map((l) => (l.product.id === id ? { ...l, qty: Math.max(0, qty) } : l)).filter((l) => l.qty > 0));
  const setSell = (id: string, sell: number) =>
    setCart((c) => c.map((l) => (l.product.id === id ? { ...l, sell: Math.max(0, sell) } : l)));
  const remove = (id: string) => setCart((c) => c.filter((l) => l.product.id !== id));

  function checkout() {
    setError(null);
    setQueued(false);
    if (!labId) { setError(t(locale, "Select a customer (lab).")); return; }
    if (cart.length === 0) { setError(t(locale, "Cart is empty.")); return; }
    const labName = labs.find((l) => l.id === labId)?.name;
    const lines = cart.map((l) => ({ product_id: l.product.id, qty: l.qty, sell_price: l.sell, name: l.product.name }));
    start(async () => {
      const res = await submitSale({ labId, labName, lines });
      if (res.status === "synced") { setDone({ count: res.count, total: res.total }); setCart([]); }
      else if (res.status === "queued") { setQueued(true); setDone(null); setCart([]); }
      else setError(res.error);
    });
  }

  const inputCls = "rounded-md border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="flex h-screen flex-col bg-surface-gray-1">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-outline-gray-2 bg-surface-white px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-gray-5 hover:bg-surface-gray-2">
            <ArrowLeftIcon size={16} /> {t(locale, "Back to app")}
          </Link>
          <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-gray-8">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm"><ShoppingCartIcon size={16} /></span>
            {t(locale, "Point of Sale")}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatus />
          <select value={labId} onChange={(e) => setLabId(e.target.value)} className={inputCls}>
            <option value="">{t(locale, "Select a customer (lab)…")}</option>
            {labs.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
          <div className="flex overflow-hidden rounded-md border border-outline-gray-2 text-sm">
            {(["USD", "IQD"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-3 py-2 font-medium ${currency === c ? "bg-brand text-white" : "bg-surface-white text-ink-gray-6 hover:bg-surface-gray-2"}`}>
                {c === "USD" ? t(locale, "USD") : t(locale, "IQD")}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* product catalogue */}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="relative mb-3">
            <SearchIcon size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-gray-4 start-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(locale, "Search products by name or code…")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSearchEnter(); } }}
              data-testid="pos-search"
              className={`${inputCls} w-full ps-9`} autoFocus />
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addProduct(p)}
                className="flex flex-col items-start rounded-xl border border-outline-gray-2 bg-surface-white p-3 text-start transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
                <span className="mb-1 rounded bg-surface-gray-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-gray-5">
                  {t(locale, TYPE_LABEL[p.product_type] ?? p.product_type)}
                </span>
                <span className="line-clamp-2 text-sm font-medium text-ink-gray-8">{p.name}</span>
                <span className="text-xs text-ink-gray-4">{p.item_code}</span>
                <span className="mt-1 text-sm font-semibold text-brand">{fmt(Number(p.default_sell_price))}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full mt-8 text-center text-sm text-ink-gray-4">{t(locale, "No products found.")}</p>
            )}
          </div>
        </div>

        {/* cart */}
        <aside className="flex w-96 shrink-0 flex-col border-s border-outline-gray-2 bg-surface-white">
          <div className="flex items-center justify-between border-b border-outline-gray-2 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink-gray-8">
              <ShoppingCartIcon size={18} /> {t(locale, "Cart")}
              <span className="rounded-full bg-surface-gray-2 px-2 text-xs text-ink-gray-5">{cart.length}</span>
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-ink-gray-4 hover:text-red-600">{t(locale, "Clear")}</button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-ink-gray-4">
                <ShoppingCartIcon size={40} strokeWidth={1.2} />
                <p className="text-sm">{t(locale, "Tap a product to add it to the cart.")}</p>
                {done && (
                  <div className="mt-4 flex flex-col items-center gap-1 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">
                    <CheckCircle2Icon size={22} />
                    <p className="text-sm font-medium">{t(locale, "Sale recorded")}</p>
                    <p className="text-xs">{done.count} {t(locale, "line(s)")} · {fmt(done.total)}</p>
                  </div>
                )}
                {queued && (
                  <div className="mt-4 flex flex-col items-center gap-1 rounded-lg bg-amber-50 px-4 py-3 text-amber-700">
                    <CloudOffIcon size={22} />
                    <p className="text-sm font-medium">{t(locale, "The program did not answer — the sale is held here and will be sent automatically.")}</p>
                  </div>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-outline-gray-1">
                {cart.map((l) => (
                  <li key={l.product.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-gray-8">{l.product.name}</p>
                        {l.product.product_type === "kit" ? <KitHint productId={l.product.id} /> : null}
                        <p className="text-xs text-ink-gray-4">{l.product.item_code}</p>
                      </div>
                      <button onClick={() => remove(l.product.id)} className="text-ink-gray-4 hover:text-red-600"><XIcon size={16} /></button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-md border border-outline-gray-2">
                        <button onClick={() => setQty(l.product.id, l.qty - 1)} className="px-2 py-1 text-ink-gray-5 hover:bg-surface-gray-2"><MinusIcon size={14} /></button>
                        <input type="number" value={l.qty} onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                          className="w-12 border-x border-outline-gray-2 py-1 text-center text-sm focus:outline-none" />
                        <button onClick={() => setQty(l.product.id, l.qty + 1)} className="px-2 py-1 text-ink-gray-5 hover:bg-surface-gray-2"><PlusIcon size={14} /></button>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-ink-gray-4">×</span>
                        <input type="number" step="0.01" value={l.sell} onChange={(e) => setSell(l.product.id, Number(e.target.value))}
                          className="w-20 rounded-md border border-outline-gray-2 px-2 py-1 text-end text-sm focus:outline-none" />
                      </div>
                      <span className="w-24 text-end text-sm font-semibold text-ink-gray-8">{fmt(l.qty * l.sell)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* totals + checkout */}
          <div className="border-t border-outline-gray-2 p-4">
            <dl className="mb-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-gray-6"><dt>{t(locale, "Subtotal")}</dt><dd>{fmt(subtotal)}</dd></div>
              <div className="flex justify-between text-emerald-600"><dt>{t(locale, "Profit")}</dt><dd>{fmt(profit)}</dd></div>
              <div className="flex justify-between border-t border-outline-gray-1 pt-1.5 text-base font-bold text-ink-gray-9">
                <dt>{t(locale, "Total")}</dt><dd>{fmt(subtotal)}</dd>
              </div>
            </dl>
            {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            {/* No internet changes nothing here: the sale is booked in this
                computer's database exactly as usual. Saying otherwise used to
                alarm people for no reason. */}
            {!online && (
              <p className="mb-2 flex items-center gap-1.5 rounded-md bg-surface-gray-1 px-3 py-2 text-xs text-ink-gray-6">
                <CloudOffIcon size={14} className="shrink-0" />
                {t(locale, "No internet — sales are still saved on this computer as usual.")}
              </p>
            )}
            <button onClick={checkout} disabled={pending || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              {pending ? <Loader2Icon size={16} className="animate-spin" /> : <CheckCircle2Icon size={16} />}
              {t(locale, "Complete sale")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
