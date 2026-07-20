"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate draft sales invoices for every AMC contract whose billing date
 * has arrived (ERPNext "Auto Repeat" / Subscription). Delegates to the
 * fn_generate_amc_invoices() Postgres function, which is idempotent per
 * period, then advances each contract's schedule.
 */
export async function generateAmcInvoices() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_run_amc_billing");
  if (error) throw new Error(error.message);
  const count = Number(data) || 0;
  revalidatePath("/amc-billing");
  revalidatePath("/sales-invoices");
  redirect(`/amc-billing?generated=${count}`);
}
