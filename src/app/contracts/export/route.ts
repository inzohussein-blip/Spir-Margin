import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";
interface Row { contract_no: string; status: string; start_date: string | null; end_date: string | null; contract_value: number; labs: { name: string } | null; devices: { asset_code: string } | null; }
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("contracts")
    .select("contract_no, status, start_date, end_date, contract_value, labs(name), devices(asset_code)")
    .order("end_date", { ascending: true });
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(["Contract no.", "Lab", "Device", "Start", "End", "Value", "Status"],
    rows.map((r) => [r.contract_no, r.labs?.name ?? "", r.devices?.asset_code ?? "", r.start_date ?? "", r.end_date ?? "", r.contract_value, r.status]));
  return csvResponse("contracts", csv);
}
