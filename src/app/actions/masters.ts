"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const NAME_TABLES = ["sales_stages", "opportunity_types", "opportunity_lost_reasons"] as const;

/** Add a row to one of the simple name-based lookup masters. */
export async function addMasterForm(fd: FormData) {
  const table = String(fd.get("table"));
  const name = String(fd.get("name") ?? "").trim();
  if (!name || !NAME_TABLES.includes(table as (typeof NAME_TABLES)[number])) return;
  const supabase = createClient();
  await supabase.from(table).insert({ name });
  revalidatePath("/masters");
}

export async function deleteMasterForm(fd: FormData) {
  const table = String(fd.get("table"));
  const allowed = [...NAME_TABLES, "terms_and_conditions"];
  if (!allowed.includes(table)) return;
  const supabase = createClient();
  await supabase.from(table).delete().eq("id", String(fd.get("id")));
  revalidatePath("/masters");
}

/** Add a Terms & Conditions entry. */
export async function addTermForm(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  const supabase = createClient();
  await supabase.from("terms_and_conditions").insert({
    title,
    terms: String(fd.get("terms") ?? "").trim() || null,
  });
  revalidatePath("/masters");
}
