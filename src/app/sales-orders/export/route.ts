import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

interface Row {
  transaction_date: string; delivery_date: string | null; status: string;
  total_amount: number; labs: { name: string } | null; sales_order_items: { id: string }[];
}

/** Whole-table CSV export of sales orders (auth-gated by middleware). */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_orders")
    .select("transaction_date, delivery_date, status, total_amount, labs(name), sales_order_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(
    ["Lab", "Order date", "Delivery", "Items", "Total", "Status"],
    rows.map((r) => [r.labs?.name ?? "", r.transaction_date, r.delivery_date ?? "", r.sales_order_items?.length ?? 0, r.total_amount, r.status]),
  );
  return csvResponse("sales-orders", csv);
}
