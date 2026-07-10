import { createClient } from "@/lib/supabase/server";

/** Reference-data lookups used to populate <select> options in forms. */

export async function getProducts(type?: "device" | "spare_part" | "kit") {
  const supabase = createClient();
  let q = supabase
    .from("products")
    .select("id, item_code, name, product_type, default_buy_price, default_sell_price")
    .eq("is_disabled", false)
    .order("name");
  if (type) q = q.eq("product_type", type);
  const { data } = await q;
  return data ?? [];
}

export async function getLabs() {
  const supabase = createClient();
  const { data } = await supabase
    .from("labs")
    .select("id, code, name")
    .order("name");
  return data ?? [];
}

export async function getWarehouses() {
  const supabase = createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("is_disabled", false)
    .order("name");
  return data ?? [];
}

export async function getSuppliers() {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");
  return data ?? [];
}

export async function getPaymentTerms() {
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_terms")
    .select("id, name, due_date_based_on, credit_days, credit_months")
    .order("name");
  return data ?? [];
}

export async function getKitBatches() {
  const supabase = createClient();
  const { data } = await supabase
    .from("kit_batches")
    .select("id, batch_no, buy_price, sell_price, qty_available, products(name)")
    .gt("qty_available", 0)
    .order("batch_no");
  return data ?? [];
}
