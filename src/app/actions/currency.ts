"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function setUsdIqdRateAction(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { error: "Only an admin or manager can set the rate" };
  }
  const rate = Number(formData.get("rate"));
  if (!(rate > 0)) return { error: "Enter a positive rate" };

  const supabase = createClient();
  const { error } = await supabase.rpc("fn_set_usd_iqd_rate", { p_rate: rate });
  if (error) return { error: "Could not save the rate" };

  revalidatePath("/currency");
  revalidatePath("/tools/profit");
  revalidatePath("/tools/converter");
  return { ok: true as const, message: `Today's rate set: 1 USD = ${rate.toLocaleString()} IQD` };
}

export async function getUsdIqdRate(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.rpc("fn_usd_iqd_rate");
  const rate = Array.isArray(data) ? Number((data[0] as Record<string, unknown>)?.fn_usd_iqd_rate ?? data[0]) : Number(data);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export async function createExchangeRate(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("currency_exchanges").insert({
    date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
    from_currency: String(fd.get("from_currency") || "").trim().toUpperCase(),
    to_currency: String(fd.get("to_currency") || "").trim().toUpperCase(),
    exchange_rate: Number(fd.get("exchange_rate") || 0),
    for_buying: fd.get("for_buying") != null,
    for_selling: fd.get("for_selling") != null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/currency");
  redirect("/currency");
}
