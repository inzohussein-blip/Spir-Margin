import { createClient } from "@/lib/supabase/server";

/** Server-side lookups for the banking module. */

export async function getBankAccounts() {
  const supabase = createClient();
  const { data } = await supabase
    .from("bank_accounts")
    .select("id, account_name, bank, currency, account_no, is_default, disabled")
    .order("account_name");
  return data ?? [];
}

export async function getRecSummary() {
  const supabase = createClient();
  const { data } = await supabase.from("v_bank_rec_summary").select("*");
  return data ?? [];
}

export async function getBankAccount(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getUnreconciledTransactions(accountId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("bank_account_id", accountId)
    .neq("status", "reconciled")
    .neq("status", "cancelled")
    .order("date", { ascending: false });
  return data ?? [];
}

/** Payment entries not yet reconciled, candidates for matching. */
export async function getOpenPaymentEntries(accountId?: string) {
  const supabase = createClient();
  let q = supabase
    .from("payment_entries")
    .select(
      "id, naming_series, payment_type, party_name, paid_amount, received_amount, reference_no, posting_date, is_reconciled"
    )
    .eq("is_reconciled", false)
    .order("posting_date", { ascending: false });
  if (accountId) q = q.eq("bank_account_id", accountId);
  const { data } = await q;
  return data ?? [];
}

export async function getPaymentEntries() {
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_entries")
    .select(
      "id, naming_series, payment_type, party_name, paid_amount, received_amount, reference_no, posting_date, is_reconciled"
    )
    .order("posting_date", { ascending: false });
  return data ?? [];
}

export async function getRules() {
  const supabase = createClient();
  const { data } = await supabase
    .from("bank_transaction_rules")
    .select("*, bank_rule_conditions(*)")
    .order("priority");
  return data ?? [];
}

/** Company + lab options for a single party <select> (value = "type:id"). */
export async function getPartyOptions() {
  const supabase = createClient();
  const [{ data: companies }, { data: labs }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("labs").select("id, name").order("name"),
  ]);
  return [
    ...(companies ?? []).map((c) => ({ value: `company:${c.id}`, label: `${c.name} (company)` })),
    ...(labs ?? []).map((l) => ({ value: `lab:${l.id}`, label: `${l.name} (lab)` })),
  ];
}
