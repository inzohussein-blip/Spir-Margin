"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertFeature } from "@/lib/features";
import { formError } from "@/lib/db/form-error";
import { CATEGORIES, parseLines, parseSteps, parseTroubles, type Category } from "@/lib/guides/core";

/** Guides & training (migration 0120). */

const FEATURE = "Guides";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function guideFields(fd: FormData) {
  const category = (str(fd, "category") ?? "device") as Category;
  return {
    title: str(fd, "title") ?? "",
    category: CATEGORIES.includes(category) ? category : "other",
    product_id: str(fd, "product_id"),
    purpose: str(fd, "purpose"),
    summary: str(fd, "summary"),
    // jsonb columns take their JSON as text (a JS array would go out as a Postgres array).
    steps: JSON.stringify(parseSteps(String(fd.get("steps") ?? ""))),
    tips: JSON.stringify(parseLines(String(fd.get("tips") ?? ""))),
    safety: str(fd, "safety"),
    troubles: JSON.stringify(parseTroubles(String(fd.get("troubles") ?? ""))),
    reviewed_by: str(fd, "reviewed_by"),
    reviewed_at: ymd(str(fd, "reviewed_at")),
    next_review: ymd(str(fd, "next_review")),
  };
}

export async function createGuide(fd: FormData) {
  await assertFeature(FEATURE);
  const row = guideFields(fd);
  if (!row.title) return { error: "Enter the guide's title" };
  const { data, error } = await createClient().from("kb_guides").insert(row).select("id").single();
  if (error) return formError(error);
  revalidatePath("/guides");
  redirect(`/guides/${(data as { id: string }).id}?saved=created`);
}

export async function updateGuide(id: string, fd: FormData) {
  await assertFeature(FEATURE);
  const row = guideFields(fd);
  if (!row.title) return { error: "Enter the guide's title" };
  const { error } = await createClient().from("kb_guides").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return formError(error);
  revalidatePath("/guides");
  revalidatePath(`/guides/${id}`);
  redirect(`/guides/${id}?saved=updated`);
}

export async function deleteGuide(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  if (!id) return { error: "Nothing to delete" };
  const supabase = createClient();
  await supabase.from("attachments").delete().eq("entity", "kb_guide").eq("record_id", id);
  const { error } = await supabase.from("kb_guides").delete().eq("id", id);
  if (error) return formError(error);
  revalidatePath("/guides");
  redirect("/guides?saved=deleted");
}

export async function createTrainee(fd: FormData) {
  await assertFeature(FEATURE);
  const name = str(fd, "full_name");
  if (!name) return { error: "Enter the trainee's name" };
  const { error } = await createClient().from("kb_trainees").insert({ full_name: name, employee_id: str(fd, "employee_id"), notes: str(fd, "notes") });
  if (error) return formError(error);
  revalidatePath("/guides/trainees");
  redirect("/guides/trainees?saved=created");
}

/** A finished quiz: its score and what was asked (kept with the trainee). */
export async function saveQuizResult(input: {
  trainee: string; category: string | null; score: number; total: number;
  details: { q: string; subject: string; chosen: string | null; right: string; ok: boolean }[];
}): Promise<{ error?: string }> {
  await assertFeature(FEATURE);
  const total = Math.max(1, Math.round(input.total));
  const score = Math.min(total, Math.max(0, Math.round(input.score)));
  if (!input.trainee) return { error: "Choose the trainee" };
  const { error } = await createClient().from("kb_results").insert({
    trainee_id: input.trainee, category: input.category, score, total, details: JSON.stringify(input.details.slice(0, 60)),
  });
  if (error) return formError(error);
  revalidatePath("/guides/trainees");
  return {};
}
