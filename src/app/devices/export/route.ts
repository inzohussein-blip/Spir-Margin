import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";
interface Row { asset_code: string; serial_no: string | null; status: string; next_maintenance_date: string | null; products: { name: string } | null; labs: { name: string } | null; }
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("devices")
    .select("asset_code, serial_no, status, next_maintenance_date, products(name), labs(name)")
    .order("asset_code");
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(["Asset code", "Product", "Serial", "Lab", "Status", "Next maintenance"],
    rows.map((r) => [r.asset_code, r.products?.name ?? "", r.serial_no ?? "", r.labs?.name ?? "", r.status, r.next_maintenance_date ?? ""]));
  return csvResponse("devices", csv);
}
