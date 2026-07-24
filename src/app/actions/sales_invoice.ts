"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface InvoiceLineInput {
  product_id: string;
  qty: number;
  rate: number;
}
export interface SalesInvoiceInput {
  invoice_no: string;
  lab_id: string;
  posting_date: string;
  due_date?: string | null;
  currency?: string;
  notes?: string;
  items: InvoiceLineInput[];
}

/** Create a draft sales invoice with its line items. */
export async function saveSalesInvoice(input: SalesInvoiceInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };
  if (!input.lab_id) return { ok: false as const, error: "Lab is required" };

  const { data: header, error: hErr } = await supabase
    .from("sales_invoices")
    .insert({
      invoice_no: input.invoice_no || null,
      lab_id: input.lab_id,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      due_date: input.due_date || null,
      currency: input.currency || "USD",
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    invoice_id: header.id,
    product_id: l.product_id,
    qty: Number(l.qty),
    rate: Number(l.rate) || 0,
  }));
  const { error: iErr } = await supabase.from("sales_invoice_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/sales-invoices");
  return { ok: true as const, invoiceId: header.id };
}

/** Edit a still-draft invoice: replace header fields and all line items.
 *  A submitted/paid/cancelled invoice is immutable here (it may carry
 *  payments and appears on statements) — only drafts can be changed. */
export async function updateSalesInvoice(id: string, input: SalesInvoiceInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Lab is required" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: existing } = await supabase.from("sales_invoices").select("status").eq("id", id).single();
  if (!existing) return { ok: false as const, error: "Invoice not found" };
  if ((existing as { status: string }).status !== "draft") {
    return { ok: false as const, error: "Only draft invoices can be edited" };
  }

  const { error: hErr } = await supabase
    .from("sales_invoices")
    .update({
      invoice_no: input.invoice_no || null,
      lab_id: input.lab_id,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      due_date: input.due_date || null,
      currency: input.currency || "USD",
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft");
  if (hErr) return { ok: false as const, error: hErr.message };

  await supabase.from("sales_invoice_items").delete().eq("invoice_id", id);
  const { error: iErr } = await supabase.from("sales_invoice_items").insert(
    lines.map((l) => ({ invoice_id: id, product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) || 0 }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/sales-invoices");
  revalidatePath(`/sales-invoices/${id}`);
  return { ok: true as const, invoiceId: id };
}

/** Delete a draft invoice. Only drafts — a submitted invoice must be
 *  cancelled (kept on record), never deleted. Lines cascade. */
export async function deleteSalesInvoiceForm(fd: FormData) {
  const supabase = createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase.from("sales_invoices").delete().eq("id", id).eq("status", "draft");
  if (error) throw new Error(error.message);
  revalidatePath("/sales-invoices");
}

export async function submitSalesInvoice(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_sales_invoice", { p_invoice_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/sales-invoices");
  return { ok: true as const };
}

export async function recordInvoicePayment(id: string, amount: number) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_record_invoice_payment", {
    p_invoice_id: id,
    p_amount: amount,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/sales-invoices");
  return { ok: true as const, outstanding: data as number };
}

export async function cancelSalesInvoice(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("sales_invoices")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "paid");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/sales-invoices");
  return { ok: true as const };
}

export async function submitSalesInvoiceForm(fd: FormData) {
  await submitSalesInvoice(String(fd.get("id")));
}
export async function cancelSalesInvoiceForm(fd: FormData) {
  await cancelSalesInvoice(String(fd.get("id")));
}
export async function recordInvoicePaymentForm(fd: FormData) {
  const amount = Number(fd.get("amount"));
  if (amount > 0) await recordInvoicePayment(String(fd.get("id")), amount);
}
