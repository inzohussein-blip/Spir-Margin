import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

interface Row {
  reference_no: string | null; posting_date: string; due_date: string | null; status: string;
  total_amount: number; companies: { name: string } | null; purchase_items: { id: string }[];
}

/** Whole-table CSV export of purchase invoices (auth-gated by middleware). */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_invoices")
    .select("reference_no, posting_date, due_date, status, total_amount, companies(name), purchase_items(id)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(
    ["Reference no.", "Supplier", "Posting date", "Due date", "Status", "Items", "Total"],
    rows.map((r) => [r.reference_no ?? "", r.companies?.name ?? "", r.posting_date, r.due_date ?? "", r.status, r.purchase_items?.length ?? 0, r.total_amount]),
  );
  return csvResponse("purchases", csv);
}
