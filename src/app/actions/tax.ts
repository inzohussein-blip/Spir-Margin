"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TaxRowInput { description: string; rate: number; account_head?: string; }
export interface TaxTemplateInput { title: string; applies_to: string; tax_category?: string; rows: TaxRowInput[]; }

export async function saveTaxTemplate(input: TaxTemplateInput) {
  const supabase = createClient();
  const rows = input.rows.filter((r) => r.description.trim() !== "");
  if (!input.title.trim()) return { ok: false as const, error: "Title required" };

  const { data: header, error: hErr } = await supabase
    .from("tax_templates")
    .insert({ title: input.title.trim(), applies_to: input.applies_to || "selling", tax_category: input.tax_category || null })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  if (rows.length) {
    const { error: iErr } = await supabase.from("tax_template_rows").insert(
      rows.map((r) => ({ template_id: header.id, description: r.description.trim(), rate: Number(r.rate) || 0, account_head: r.account_head || null }))
    );
    if (iErr) return { ok: false as const, error: iErr.message };
  }
  revalidatePath("/taxes");
  return { ok: true as const, id: header.id };
}
