"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ------- FormData helpers (mirrors crud.ts) -------------------------------
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function req(fd: FormData, k: string): string {
  const s = str(fd, k);
  if (s == null) throw new Error(`Field "${k}" is required`);
  return s;
}
function num(fd: FormData, k: string): number {
  const s = str(fd, k);
  return s == null ? 0 : Number(s);
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) != null;
}
// party selects submit "company:<id>" or "lab:<id>"
function party(fd: FormData, k: string) {
  const s = str(fd, k);
  if (!s) return { party_type: null, party_company_id: null, party_lab_id: null };
  const [type, id] = s.split(":");
  return {
    party_type: type as "company" | "lab",
    party_company_id: type === "company" ? id : null,
    party_lab_id: type === "lab" ? id : null,
  };
}

// ========================================================================
// Bank accounts  <- BankAccount
// ========================================================================
export async function createBankAccount(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("bank_accounts").insert({
    account_name: req(fd, "account_name"),
    bank: req(fd, "bank"),
    account_type: str(fd, "account_type"),
    account_no: str(fd, "account_no"),
    iban: str(fd, "iban"),
    currency: str(fd, "currency") ?? "USD",
    is_company_account: bool(fd, "is_company_account"),
    is_default: bool(fd, "is_default"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/banking");
  redirect("/banking");
}

// ========================================================================
// Payment entries  <- PaymentEntry
// ========================================================================
export async function createPaymentEntry(fd: FormData) {
  const supabase = createClient();
  const type = req(fd, "payment_type");
  const amount = num(fd, "amount");
  const { error } = await supabase.from("payment_entries").insert({
    payment_type: type,
    posting_date: str(fd, "posting_date") ?? new Date().toISOString().slice(0, 10),
    ...party(fd, "party"),
    party_name: str(fd, "party_name"),
    mode_of_payment: str(fd, "mode_of_payment"),
    bank_account_id: str(fd, "bank_account_id"),
    paid_amount: type === "pay" ? amount : 0,
    received_amount: type === "receive" ? amount : 0,
    reference_no: str(fd, "reference_no"),
    reference_date: str(fd, "reference_date"),
    remarks: str(fd, "remarks"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/banking");
  redirect("/banking/payments");
}

// ========================================================================
// Bank transactions  <- BankTransaction (manual entry)
// ========================================================================
export async function createBankTransaction(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("bank_transactions").insert({
    bank_account_id: req(fd, "bank_account_id"),
    date: str(fd, "date") ?? new Date().toISOString().slice(0, 10),
    deposit: num(fd, "deposit"),
    withdrawal: num(fd, "withdrawal"),
    description: str(fd, "description"),
    reference_number: str(fd, "reference_number"),
    transaction_id: str(fd, "transaction_id"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/banking/${req(fd, "bank_account_id")}`);
  redirect(`/banking/${req(fd, "bank_account_id")}`);
}

// ========================================================================
// Reconciliation actions (call the SQL RPCs)
// ========================================================================
export async function reconcile(
  txnId: string,
  paymentId: string,
  accountId: string,
  amount?: number
) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_reconcile_transaction", {
    p_txn_id: txnId,
    p_payment_id: paymentId,
    p_amount: amount ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/banking/${accountId}`);
  revalidatePath("/banking");
  return { ok: true as const };
}

export async function unreconcile(txnId: string, accountId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_unreconcile_transaction", {
    p_txn_id: txnId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/banking/${accountId}`);
  revalidatePath("/banking");
  return { ok: true as const };
}

/** Run the rule engine over every unreconciled transaction of an account. */
export async function applyRulesForAccount(accountId: string) {
  const supabase = createClient();
  const { data: txns, error } = await supabase
    .from("bank_transactions")
    .select("id")
    .eq("bank_account_id", accountId)
    .neq("status", "reconciled");
  if (error) return { ok: false as const, error: error.message };

  let matched = 0;
  for (const t of txns ?? []) {
    const { data } = await supabase.rpc("fn_apply_rules", { p_txn_id: t.id });
    if (data) matched++;
  }
  revalidatePath(`/banking/${accountId}`);
  return { ok: true as const, matched };
}

// ========================================================================
// Matching rules  <- BankTransactionRule
// ========================================================================
export async function createRule(fd: FormData) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bank_transaction_rules")
    .insert({
      rule_name: req(fd, "rule_name"),
      transaction_type: str(fd, "transaction_type") ?? "any",
      priority: num(fd, "priority") || 1,
      min_amount: str(fd, "min_amount") ? num(fd, "min_amount") : null,
      max_amount: str(fd, "max_amount") ? num(fd, "max_amount") : null,
      classify_as: str(fd, "classify_as") ?? "payment_entry",
      ...party(fd, "party"),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const condValue = str(fd, "condition_value");
  if (condValue) {
    await supabase.from("bank_rule_conditions").insert({
      rule_id: data.id,
      field: str(fd, "condition_field") ?? "description",
      operator: str(fd, "condition_operator") ?? "contains",
      value: condValue,
    });
  }
  revalidatePath("/banking/rules");
  redirect("/banking/rules");
}

// ========================================================================
// CSV statement import — insert parsed rows as bank transactions
// ========================================================================
export interface ImportRow {
  date: string;
  deposit: number;
  withdrawal: number;
  description?: string;
  reference_number?: string;
  transaction_id?: string;
}

export async function importTransactions(
  accountId: string,
  currency: string,
  fileName: string,
  rows: ImportRow[]
) {
  const supabase = createClient();

  const debits = rows.filter((r) => r.withdrawal > 0);
  const credits = rows.filter((r) => r.deposit > 0);
  const dates = rows.map((r) => r.date).filter(Boolean).sort();

  const { data: log, error: logErr } = await supabase
    .from("bank_statement_import_logs")
    .insert({
      bank_account_id: accountId,
      file_name: fileName,
      status: "completed",
      currency,
      number_of_transactions: rows.length,
      start_date: dates[0] ?? null,
      end_date: dates[dates.length - 1] ?? null,
      total_debits: debits.reduce((s, r) => s + r.withdrawal, 0),
      total_credits: credits.reduce((s, r) => s + r.deposit, 0),
      total_debit_transactions: debits.length,
      total_credit_transactions: credits.length,
    })
    .select("id")
    .single();
  if (logErr) return { ok: false as const, error: logErr.message };

  const payload = rows.map((r) => ({
    bank_account_id: accountId,
    date: r.date,
    deposit: r.deposit || 0,
    withdrawal: r.withdrawal || 0,
    currency,
    description: r.description ?? null,
    reference_number: r.reference_number ?? null,
    transaction_id: r.transaction_id ?? null,
    import_log_id: log.id,
  }));

  // ignore duplicates on (bank_account_id, transaction_id)
  const { error, count } = await supabase
    .from("bank_transactions")
    .upsert(payload, {
      onConflict: "bank_account_id,transaction_id",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/banking/${accountId}`);
  revalidatePath("/banking");
  return { ok: true as const, inserted: count ?? payload.length };
}
