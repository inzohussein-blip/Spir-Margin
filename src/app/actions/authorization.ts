"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/pglite";
import { formError } from "@/lib/db/form-error";

export interface AuthorizationLine {
  device_id?: string | null;
  description: string;
  qty: number;
  unit?: string | null;
  serial_no?: string | null;
}

export interface AuthorizationInput {
  issue_date: string;
  valid_from: string;
  valid_to: string;
  addressed_to?: string | null;
  bearer_name: string;
  bearer_id_no?: string | null;
  bearer_phone?: string | null;
  driver_name?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  from_governorate: string;
  to_governorate: string;
  destination?: string | null;
  purpose?: string | null;
  notes?: string | null;
  items: AuthorizationLine[];
}

export async function saveAuthorization(input: AuthorizationInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const lines = (input.items ?? []).filter(
    (l) => (l.description ?? "").trim().length > 0 && Number(l.qty) > 0,
  );
  if (lines.length === 0) return { error: "List at least one item being moved" };
  if (!(input.bearer_name ?? "").trim()) return { error: "Enter the name of the person authorised" };
  if (!input.from_governorate || !input.to_governorate) {
    return { error: "Choose where it is going from and to" };
  }
  if (input.valid_to < input.valid_from) {
    return { error: "The end of the period cannot be before its start" };
  }

  const supabase = createClient();
  const { db } = await getDb();
  const no = await db.query<{ n: string }>(`select fn_next_doc_no('ta') as n`);

  const { data, error } = await supabase
    .from("transport_authorizations")
    .insert({
      auth_no: no.rows[0].n,
      issue_date: input.issue_date,
      valid_from: input.valid_from,
      valid_to: input.valid_to,
      addressed_to: (input.addressed_to ?? "").trim() || null,
      bearer_name: input.bearer_name.trim(),
      bearer_id_no: (input.bearer_id_no ?? "").trim() || null,
      bearer_phone: (input.bearer_phone ?? "").trim() || null,
      driver_name: (input.driver_name ?? "").trim() || null,
      vehicle_type: (input.vehicle_type ?? "").trim() || null,
      vehicle_plate: (input.vehicle_plate ?? "").trim() || null,
      from_governorate: input.from_governorate,
      to_governorate: input.to_governorate,
      destination: (input.destination ?? "").trim() || null,
      purpose: (input.purpose ?? "").trim() || null,
      notes: (input.notes ?? "").trim() || null,
      created_by: user.email,
    })
    .select("id")
    .single();
  if (error) return formError(error);

  const id = (data as { id: string }).id;
  const { error: itemsError } = await supabase.from("transport_authorization_items").insert(
    lines.map((l, i) => ({
      auth_id: id,
      device_id: l.device_id || null,
      description: l.description.trim(),
      qty: Number(l.qty),
      unit: (l.unit ?? "").trim() || null,
      serial_no: (l.serial_no ?? "").trim() || null,
      line_no: i + 1,
    })),
  );
  if (itemsError) return formError(itemsError);

  revalidatePath("/authorizations");
  redirect(`/authorizations/${id}?saved=created`);
}

export async function cancelAuthorization(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = createClient();
  await supabase
    .from("transport_authorizations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(`/authorizations/${id}`);
  revalidatePath("/authorizations");
}
