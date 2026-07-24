import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

interface Row {
  invoice_no: string; posting_date: string; due_date: string | null; status: string;
  total_amount: number; paid_amount: number; outstanding: number; labs: { name: string } | null;
}

/** Whole-table CSV export of sales invoices (auth-gated by middleware). */
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select("invoice_no, posting_date, due_date, status, total_amount, paid_amount, outstanding, labs(name)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(
    ["Invoice no.", "Lab", "Posting date", "Due date", "Status", "Total", "Paid", "Outstanding"],
    rows.map((r) => [r.invoice_no, r.labs?.name ?? "", r.posting_date, r.due_date ?? "", r.status, r.total_amount, r.paid_amount, r.outstanding]),
  );
  return csvResponse("sales-invoices", csv);
}
