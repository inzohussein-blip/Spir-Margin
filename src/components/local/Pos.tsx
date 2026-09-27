"use client";

import { useMemo } from "react";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { DataActionsProvider, type DataActions } from "@/components/data/DataActions";
import { nextBatches, type BatchRow } from "@/lib/kits";
import { localDate } from "@/lib/dates";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { useLocalQuery, useRuntime } from "./hooks";
import { SyncChip } from "./parts";

type Product = { id: string; item_code: string; name: string; product_type: string; default_buy_price: number; default_sell_price: number };
type Lab = { id: string; code: string; name: string };

/**
 * The point of sale on the browser's own database: the same terminal as the
 * installed version, with the sale booked by the same function
 * (fn_pos_checkout) here, and sent to the company's database at the next sync.
 */
export function LocalPos() {
  const locale = useLocale();
  const rt = useRuntime([]);
  const products = useLocalQuery<Product[]>(
    (c) => c.from("products").select("id, item_code, name, product_type, default_buy_price, default_sell_price").eq("is_disabled", false).order("name"), []);
  const labs = useLocalQuery<Lab[]>((c) => c.from("labs").select("id, code, name").order("name"), []);
  const rate = useLocalQuery<number>((c) => c.rpc("fn_usd_iqd_rate"), []);

  const actions = useMemo<DataActions>(() => ({
    homeHref: "#/",
    statusSlot: <SyncChip />,
    submitSale: async (p) => {
      const c = rt.client;
      if (!c) return { status: "error", error: t(locale, "The database is not open yet.") };
      const lines = p.lines.filter((l) => l.product_id && Number(l.qty) > 0)
        .map((l) => ({ product_id: l.product_id, qty: Number(l.qty), sell_price: Number(l.sell_price) || 0 }));
      if (!p.labId) return { status: "error", error: t(locale, "Select a customer (lab).") };
      if (!lines.length) return { status: "error", error: t(locale, "Cart is empty.") };
      await rt.setActor();
      const { data, error } = await c.rpc("fn_pos_checkout", {
        p_request_id: crypto.randomUUID(),
        p_lab_id: p.labId,
        p_lines: JSON.stringify(lines),
      });
      if (error) return { status: "error", error: error.message };
      rt.afterWrite();
      const row = (data as { n_lines: number; total_amount: number }[] | null)?.[0];
      return { status: "synced", count: Number(row?.n_lines ?? 0), total: Number(row?.total_amount ?? 0) };
    },
    kitHints: async () => {
      const c = rt.client;
      if (!c) return {};
      const { data } = await c.from("kit_batches").select("product_id, batch_no, expiry_date, qty_available, created_at").gt("qty_available", 0);
      return nextBatches((data as BatchRow[] | null) ?? [], localDate());
    },
  }), [rt, locale]);

  if (!products.data || !labs.data) return <p className="p-6 text-sm text-ink-gray-5">{t(locale, "Loading…")}</p>;
  return (
    <DataActionsProvider value={actions}>
      <PosTerminal products={products.data} labs={labs.data} iqdRate={Number(rate.data) || 1310} />
    </DataActionsProvider>
  );
}
