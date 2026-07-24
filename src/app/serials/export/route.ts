import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";
interface Row { serial_no: string; status: string; maintenance_status: string | null; warranty_expiry_date: string | null; products: { name: string } | null; labs: { name: string } | null; }
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("serial_numbers")
    .select("serial_no, status, maintenance_status, warranty_expiry_date, products(name), labs(name)")
    .order("serial_no");
  const rows = (data as unknown as Row[]) ?? [];
  const csv = toCsv(["Serial", "Product", "Lab", "Status", "Maintenance", "Warranty expiry"],
    rows.map((r) => [r.serial_no, r.products?.name ?? "", r.labs?.name ?? "", r.status, r.maintenance_status ?? "", r.warranty_expiry_date ?? ""]));
  return csvResponse("serials", csv);
}
