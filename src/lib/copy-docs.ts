import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import type { QuotationInput } from "@/app/actions/quotation";
import type { SalesInvoiceInput } from "@/app/actions/sales_invoice";
import type { PurchaseOrderInput } from "@/app/actions/purchase_order";
import type { SalesOrderInput } from "@/app/actions/selling";
import type { SaleRequestInput } from "@/app/actions/sale_request";

/**
 * "Copy": a new document that starts as an existing one — the same customer
 * or supplier, the same lines and prices — dated today, with its own number
 * to come. A customer who orders the same things every month is a copy and
 * a save, not a form filled in again.
 *
 * Only what describes the order is copied: numbers, dates that were about
 * the old document (due, valid till, delivery), and serial numbers (each
 * belongs to one device) are left for the new one.
 */

type Line = { product_id: string; qty: number; rate: number };
const lines = (rows: { product_id: string; qty: number; rate: number }[] | null | undefined): Line[] => {
  const out = (rows ?? []).map((r) => ({ product_id: r.product_id, qty: Number(r.qty), rate: Number(r.rate) }));
  return out.length ? out : [{ product_id: "", qty: 1, rate: 0 }];
};

export async function copyQuotation(id: string): Promise<QuotationInput | null> {
  const { data } = await createClient()
    .from("quotations")
    .select("lab_id, notes, quotation_items(product_id, qty, rate)")
    .eq("id", id)
    .maybeSingle();
  const q = data as unknown as { lab_id: string; notes: string | null; quotation_items: Line[] } | null;
  if (!q) return null;
  return { lab_id: q.lab_id, transaction_date: localDate(), valid_till: "", notes: q.notes ?? "", items: lines(q.quotation_items) };
}

export async function copySalesInvoice(id: string): Promise<SalesInvoiceInput | null> {
  const { data } = await createClient()
    .from("sales_invoices")
    .select("lab_id, currency, notes, sales_invoice_items(product_id, qty, rate)")
    .eq("id", id)
    .maybeSingle();
  const inv = data as unknown as { lab_id: string; currency: string | null; notes: string | null; sales_invoice_items: Line[] } | null;
  if (!inv) return null;
  return {
    invoice_no: "",
    lab_id: inv.lab_id,
    posting_date: localDate(),
    due_date: "",
    currency: (inv.currency ?? "USD") as SalesInvoiceInput["currency"],
    notes: inv.notes ?? "",
    items: lines(inv.sales_invoice_items),
  };
}

export async function copyPurchaseOrder(id: string): Promise<PurchaseOrderInput | null> {
  const { data } = await createClient()
    .from("purchase_orders")
    .select("supplier_id, notes, purchase_order_items(product_id, qty, rate)")
    .eq("id", id)
    .maybeSingle();
  const po = data as unknown as { supplier_id: string | null; notes: string | null; purchase_order_items: Line[] } | null;
  if (!po) return null;
  return {
    po_no: "",
    supplier_id: po.supplier_id ?? "",
    transaction_date: localDate(),
    required_by: "",
    notes: po.notes ?? "",
    items: lines(po.purchase_order_items),
  };
}

export async function copySalesOrder(id: string): Promise<SalesOrderInput | null> {
  const { data } = await createClient()
    .from("sales_orders")
    .select("lab_id, notes, sales_order_items(product_id, qty, rate)")
    .eq("id", id)
    .maybeSingle();
  const so = data as unknown as { lab_id: string; notes: string | null; sales_order_items: Line[] } | null;
  if (!so) return null;
  return {
    lab_id: so.lab_id,
    transaction_date: localDate(),
    delivery_date: "",
    notes: so.notes ?? "",
    items: lines(so.sales_order_items).map((l) => ({ ...l, serial_no: "" })),
  };
}

export async function copySaleRequest(id: string): Promise<SaleRequestInput | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("sale_requests")
    .select("lab_id, customer_name, customer_phone, currency, discount, notes")
    .eq("id", id)
    .maybeSingle();
  const r = data as unknown as {
    lab_id: string | null; customer_name: string | null; customer_phone: string | null;
    currency: SaleRequestInput["currency"]; discount: number; notes: string | null;
  } | null;
  if (!r) return null;
  const { data: items } = await supabase
    .from("sale_request_items")
    .select("product_id, description, qty, rate, line_no")
    .eq("request_id", id)
    .order("line_no");
  const rows = (items as unknown as { product_id: string | null; description: string; qty: number; rate: number }[]) ?? [];
  return {
    lab_id: r.lab_id ?? "",
    customer_name: r.customer_name ?? "",
    customer_phone: r.customer_phone ?? "",
    request_date: localDate(),
    currency: r.currency,
    discount: Number(r.discount),
    notes: r.notes ?? "",
    items: rows.length
      ? rows.map((i) => ({ product_id: i.product_id ?? "", description: i.description, qty: Number(i.qty), rate: Number(i.rate) }))
      : [{ product_id: "", description: "", qty: 1, rate: 0 }],
  };
}
