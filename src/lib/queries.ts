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

export async function getUoms() {
  const supabase = createClient();
  const { data } = await supabase
    .from("uoms")
    .select("uom_name")
    .eq("enabled", true)
    .order("uom_name");
  return (data ?? []).map((u) => u.uom_name as string);
}

export async function getBrands() {
  const supabase = createClient();
  const { data } = await supabase.from("brands").select("name").order("name");
  return (data ?? []).map((b) => b.name as string);
}

export async function getItemGroups() {
  const supabase = createClient();
  const { data } = await supabase.from("item_groups").select("name").order("name");
  return (data ?? []).map((g) => g.name as string);
}

export async function getAssetCategories() {
  const supabase = createClient();
  const { data } = await supabase.from("asset_categories").select("name").order("name");
  return (data ?? []).map((a) => a.name as string);
}

export async function getSupplierGroups() {
  const supabase = createClient();
  const { data } = await supabase.from("supplier_groups").select("name").order("name");
  return (data ?? []).map((g) => g.name as string);
}

export async function getTerritories() {
  const supabase = createClient();
  const { data } = await supabase.from("territories").select("name").order("name");
  return (data ?? []).map((t) => t.name as string);
}

export async function getCustomerGroups() {
  const supabase = createClient();
  const { data } = await supabase.from("customer_groups").select("name").order("name");
  return (data ?? []).map((g) => g.name as string);
}

export async function getPriceLists() {
  const supabase = createClient();
  const { data } = await supabase
    .from("price_lists")
    .select("price_list_name")
    .eq("enabled", true)
    .order("price_list_name");
  return (data ?? []).map((p) => p.price_list_name as string);
}

export async function getModesOfPayment() {
  const supabase = createClient();
  const { data } = await supabase
    .from("modes_of_payment")
    .select("name")
    .eq("enabled", true)
    .order("name");
  return (data ?? []).map((m) => m.name as string);
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

export async function getDevices(labId?: string) {
  const supabase = createClient();
  let q = supabase
    .from("devices")
    .select("id, asset_code, serial_no, lab_id, products(name)")
    .order("asset_code");
  if (labId) q = q.eq("lab_id", labId);
  const { data } = await q;
  return data ?? [];
}
