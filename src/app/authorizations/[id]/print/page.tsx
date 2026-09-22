import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationSheet, type AuthDoc, type AuthItem } from "@/components/print/AuthorizationSheet";

export const dynamic = "force-dynamic";

export default async function AuthorizationPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("transport_authorizations")
    .select("auth_no, issue_date, valid_from, valid_to, addressed_to, bearer_name, bearer_id_no, bearer_phone, driver_name, vehicle_type, vehicle_plate, from_governorate, to_governorate, destination, purpose, notes, status")
    .eq("id", params.id)
    .single();
  const doc = data as unknown as AuthDoc | null;
  if (!doc) notFound();

  const { data: itemRows } = await supabase
    .from("transport_authorization_items")
    .select("description, qty, unit, serial_no, line_no")
    .eq("auth_id", params.id)
    .order("line_no");

  return <AuthorizationSheet doc={doc} items={(itemRows as unknown as AuthItem[]) ?? []} />;
}
