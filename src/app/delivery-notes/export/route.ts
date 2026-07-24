import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";
interface Row { posting_date: string; status: string; labs: { name: string } | null; delivery_note_items: { id: string }[]; }
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("delivery_notes")
    .select("posting_date, status, labs(name), delivery_note_items(id)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(["Lab", "Date", "Items", "Status"],
    rows.map((r) => [r.labs?.name ?? "", r.posting_date, r.delivery_note_items?.length ?? 0, r.status]));
  return csvResponse("delivery-notes", csv);
}
