"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PaymentRequestInput {
  request_no: string;
  invoice_id: string;
  lab_id: string | null;
  amount: number;
  mode_of_payment_id: string | null;
  posting_date: string;
  message?: string;
}

export async function savePaymentRequest(input: PaymentRequestInput) {
  const supabase = createClient();
  if (!input.invoice_id) return { ok: false as const, error: "Pick an invoice" };
  if (!(Number(input.amount) > 0)) return { ok: false as const, error: "Amount must be positive" };

  const requestNo = input.request_no?.trim() || `PREQ-${Date.now().toString().slice(-8)}`;
  const { data, error } = await supabase
    .from("payment_requests")
    .insert({
      request_no: requestNo,
      invoice_id: input.invoice_id,
      lab_id: input.lab_id || null,
      amount: Number(input.amount),
      mode_of_payment_id: input.mode_of_payment_id || null,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      message: input.message || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/payment-requests");
  return { ok: true as const, requestId: data.id };
}

export async function submitPaymentRequestForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_payment_request", { p_request_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/payment-requests");
}

export async function payPaymentRequestForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_pay_payment_request", { p_request_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/payment-requests");
  revalidatePath("/sales-invoices");
}

export async function cancelPaymentRequestForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("payment_requests").update({ status: "cancelled" }).eq("id", String(fd.get("id"))).neq("status", "paid");
  revalidatePath("/payment-requests");
}
