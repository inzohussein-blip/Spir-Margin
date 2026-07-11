"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface JournalLineInput { account: string; debit: number; credit: number; user_remark?: string; }
export interface JournalInput {
  posting_date: string;
  voucher_type?: string;
  user_remark?: string;
  lines: JournalLineInput[];
}

export async function saveJournalEntry(input: JournalInput) {
  const supabase = createClient();
  const lines = input.lines.filter((l) => l.account && (Number(l.debit) > 0 || Number(l.credit) > 0));
  if (lines.length < 2) return { ok: false as const, error: "A journal needs at least two lines" };

  const { data: header, error: hErr } = await supabase
    .from("journal_entries")
    .insert({
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      voucher_type: input.voucher_type || "Journal Entry",
      user_remark: input.user_remark || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("journal_entry_accounts").insert(
    lines.map((l) => ({
      journal_entry_id: header.id,
      account: l.account,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      user_remark: l.user_remark || null,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/journal-entries");
  return { ok: true as const, journalId: header.id };
}

export async function postJournalEntryForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_post_journal_entry", { p_je_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/journal-entries");
}
