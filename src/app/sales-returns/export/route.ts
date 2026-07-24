import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

interface Row {
  return_no: string; posting_date: string; status: string; reason: string | null;
  total_amount: number; labs: { name: string } | null; sales_return_items: { id: string }[];
}

/** Whole-table CSV export of sales returns (auth-gated by middleware). */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_returns")
    .select("return_no, posting_date, status, reason, total_amount, labs(name), sales_return_items(id)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(
    ["Return no.", "Lab", "Date", "Reason", "Items", "Total", "Status"],
    rows.map((r) => [r.return_no, r.labs?.name ?? "", r.posting_date, r.reason ?? "", r.sales_return_items?.length ?? 0, r.total_amount, r.status]),
  );
  return csvResponse("sales-returns", csv);
}
