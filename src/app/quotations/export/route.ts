import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";
interface Row { transaction_date: string; valid_till: string | null; status: string; total_amount: number; labs: { name: string } | null; quotation_items: { id: string }[]; }
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("quotations")
    .select("transaction_date, valid_till, status, total_amount, labs(name), quotation_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(["Lab", "Date", "Valid till", "Items", "Total", "Status"],
    rows.map((r) => [r.labs?.name ?? "", r.transaction_date, r.valid_till ?? "", r.quotation_items?.length ?? 0, r.total_amount, r.status]));
  return csvResponse("quotations", csv);
}
