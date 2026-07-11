"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
