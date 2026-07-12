"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface QiReadingInput {
  parameter: string;
  reading_value?: number | string;
  min_value?: number | string;
  max_value?: number | string;
}
export interface QualityInspectionInput {
  qi_no: string;
  report_date: string;
  inspection_type: "incoming" | "outgoing" | "in_process";
  product_id?: string | null;
  batch_id?: string | null;
  sample_size?: number;
  inspected_by?: string;
  remarks?: string;
  readings: QiReadingInput[];
}

const num = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Create a quality inspection with its parameter readings. */
export async function saveQualityInspection(input: QualityInspectionInput) {
  const supabase = createClient();

  const rows = input.readings.filter((r) => r.parameter && r.parameter.trim());
  if (rows.length === 0) return { ok: false as const, error: "Add at least one reading" };

  const { data: header, error: hErr } = await supabase
    .from("quality_inspections")
    .insert({
      qi_no: input.qi_no || null,
      report_date: input.report_date || new Date().toISOString().slice(0, 10),
      inspection_type: input.inspection_type,
      product_id: input.product_id || null,
      batch_id: input.batch_id || null,
      sample_size: Number(input.sample_size) || 1,
      inspected_by: input.inspected_by || null,
      remarks: input.remarks || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = rows.map((r) => ({
    qi_id: header.id,
    parameter: r.parameter.trim(),
    reading_value: num(r.reading_value),
    min_value: num(r.min_value),
    max_value: num(r.max_value),
    numeric_check: num(r.reading_value) != null || num(r.min_value) != null || num(r.max_value) != null,
  }));
  const { error: iErr } = await supabase.from("quality_inspection_readings").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/quality-inspections");
  return { ok: true as const, qiId: header.id };
}

/** Grade readings and set the header accepted/rejected. */
export async function evaluateQualityInspection(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_evaluate_quality_inspection", { p_qi_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/quality-inspections");
  return { ok: true as const, status: data as string };
}

export async function cancelQualityInspection(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("quality_inspections")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/quality-inspections");
  return { ok: true as const };
}

export async function evaluateQualityInspectionForm(fd: FormData) {
  await evaluateQualityInspection(String(fd.get("id")));
}
export async function cancelQualityInspectionForm(fd: FormData) {
  await cancelQualityInspection(String(fd.get("id")));
}
