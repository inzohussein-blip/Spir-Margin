"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TripStopInput {
  lab_id?: string;
  delivery_note_id?: string;
  address?: string;
  seq: number;
}
export interface DeliveryTripInput {
  trip_no: string;
  driver_name?: string;
  vehicle?: string;
  departure_date: string;
  notes?: string;
  stops: TripStopInput[];
}

export async function saveDeliveryTrip(input: DeliveryTripInput) {
  const supabase = createClient();
  const stops = input.stops.filter((s) => s.lab_id || s.delivery_note_id || s.address);
  if (stops.length === 0) return { ok: false as const, error: "Add at least one stop" };

  const tripNo = input.trip_no?.trim() || `TRIP-${Date.now().toString().slice(-8)}`;
  const { data: header, error: hErr } = await supabase
    .from("delivery_trips")
    .insert({
      trip_no: tripNo,
      driver_name: input.driver_name || null,
      vehicle: input.vehicle || null,
      departure_date: input.departure_date || new Date().toISOString().slice(0, 10),
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: sErr } = await supabase.from("delivery_trip_stops").insert(
    stops.map((s, i) => ({
      trip_id: header.id,
      lab_id: s.lab_id || null,
      delivery_note_id: s.delivery_note_id || null,
      address: s.address || null,
      seq: Number(s.seq) || i + 1,
    }))
  );
  if (sErr) return { ok: false as const, error: sErr.message };

  revalidatePath("/delivery-trips");
  return { ok: true as const, tripId: header.id };
}

export async function startDeliveryTripForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_start_delivery_trip", { p_trip_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/delivery-trips");
}

export async function completeDeliveryTripForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_complete_delivery_trip", { p_trip_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/delivery-trips");
}

export async function cancelDeliveryTripForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("delivery_trips").update({ status: "cancelled" }).eq("id", String(fd.get("id"))).neq("status", "completed");
  revalidatePath("/delivery-trips");
}
