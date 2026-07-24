import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";
interface Row { posting_date: string; voucher_type: string; status: string; user_remark: string | null; total_debit: number; total_credit: number; }
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("journal_entries")
    .select("posting_date, voucher_type, status, user_remark, total_debit, total_credit")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(["Date", "Type", "Remark", "Debit", "Credit", "Status"],
    rows.map((r) => [r.posting_date, r.voucher_type, r.user_remark ?? "", r.total_debit, r.total_credit, r.status]));
  return csvResponse("journal-entries", csv);
}
