"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/pglite";
import { formError } from "@/lib/db/form-error";

export interface SaleRequestLine {
  product_id?: string | null;
  description: string;
  qty: number;
  rate: number;
}

export interface SaleRequestInput {
  lab_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  request_date: string;
  currency?: string;
  discount?: number;
  notes?: string | null;
  items: SaleRequestLine[];
}

/** Keep only lines someone actually filled in. */
function usable(items: SaleRequestLine[]): SaleRequestLine[] {
  return (items ?? []).filter(
    (l) => (l.description ?? "").trim().length > 0 && Number(l.qty) > 0,
  );
}

export async function saveSaleRequest(input: SaleRequestInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const lines = usable(input.items);
  if (lines.length === 0) return { error: "Add at least one line" };
  if (!input.lab_id && !(input.customer_name ?? "").trim()) {
    return { error: "Choose a lab or enter a customer name" };
  }

  const supabase = createClient();
  const { db } = await getDb();

  // The number is minted by the database so two requests at once cannot be
  // handed the same one.
  const no = await db.query<{ n: string }>(`select fn_next_doc_no('req') as n`);

  const { data, error } = await supabase
    .from("sale_requests")
    .insert({
      request_no: no.rows[0].n,
      request_date: input.request_date,
      lab_id: input.lab_id || null,
      customer_name: (input.customer_name ?? "").trim() || null,
      customer_phone: (input.customer_phone ?? "").trim() || null,
      currency: input.currency || "USD",
      discount: Number(input.discount ?? 0) || 0,
      notes: (input.notes ?? "").trim() || null,
      created_by: user.email,
    })
    .select("id")
    .single();
  if (error) return formError(error);

  const id = (data as { id: string }).id;
  const { error: itemsError } = await supabase.from("sale_request_items").insert(
    lines.map((l, i) => ({
      request_id: id,
      product_id: l.product_id || null,
      description: l.description.trim(),
      qty: Number(l.qty),
      rate: Number(l.rate) || 0,
      line_no: i + 1,
    })),
  );
  if (itemsError) return formError(itemsError);

  revalidatePath("/sale-requests");
  redirect(`/sale-requests/${id}?saved=created`);
}

export async function setSaleRequestStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "confirmed", "delivered", "cancelled"].includes(status)) return;

  const supabase = createClient();
  await supabase.from("sale_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/sale-requests/${id}`);
  revalidatePath("/sale-requests");
}
