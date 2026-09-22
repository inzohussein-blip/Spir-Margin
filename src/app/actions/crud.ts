"use server";

import { formError } from "@/lib/db/form-error";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertFeature } from "@/lib/features";
import { localDate } from "@/lib/dates";

// -------------------------------------------------------------------------
// Small helpers for reading typed values out of a <form> FormData payload.
// -------------------------------------------------------------------------
function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function req(fd: FormData, key: string): string {
  const s = str(fd, key);
  if (s == null) throw new Error(`Field "${key}" is required`);
  return s;
}
function num(fd: FormData, key: string): number {
  const s = str(fd, key);
  return s == null ? 0 : Number(s);
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) != null;
}

// =========================================================================
// Labs
// =========================================================================
export async function createLab(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("labs").insert({
    code: req(fd, "code"),
    name: req(fd, "name"),
    status: str(fd, "status") ?? "active",
    city: str(fd, "city"),
    address: str(fd, "address"),
    contact_name: str(fd, "contact_name"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    territory: str(fd, "territory"),
    customer_group: str(fd, "customer_group"),
    latitude: str(fd, "latitude") ? num(fd, "latitude") : null,
    longitude: str(fd, "longitude") ? num(fd, "longitude") : null,
  });
  if (error) return formError(error);
  revalidatePath("/labs");
  redirect("/labs?saved=created");
}

export async function updateLab(id: string, fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("labs")
    .update({
      name: req(fd, "name"),
      status: str(fd, "status") ?? "active",
      city: str(fd, "city"),
      address: str(fd, "address"),
      contact_name: str(fd, "contact_name"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return formError(error);
  revalidatePath("/labs");
  redirect("/labs?saved=created");
}

// =========================================================================
// Devices
// =========================================================================
export async function createDevice(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("devices").insert({
    asset_code: req(fd, "asset_code"),
    product_id: req(fd, "product_id"),
    serial_no: str(fd, "serial_no"),
    status: str(fd, "status") ?? "in_stock",
    lab_id: str(fd, "lab_id"),
    custodian_name: str(fd, "custodian_name"),
    asset_category: str(fd, "asset_category"),
    purchase_date: str(fd, "purchase_date"),
    purchase_price: num(fd, "purchase_price"),
    maintenance_required: bool(fd, "maintenance_required"),
    next_maintenance_date: str(fd, "next_maintenance_date"),
  });
  if (error) return formError(error);
  revalidatePath("/devices");
  redirect("/devices?saved=created");
}

export async function updateDevice(id: string, fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("devices")
    .update({
      serial_no: str(fd, "serial_no"),
      status: str(fd, "status") ?? "in_stock",
      lab_id: str(fd, "lab_id"),
      custodian_name: str(fd, "custodian_name"),
      maintenance_required: bool(fd, "maintenance_required"),
      next_maintenance_date: str(fd, "next_maintenance_date"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return formError(error);
  revalidatePath("/devices");
  redirect("/devices?saved=created");
}

/** Log a maintenance visit and roll the device's next-due date forward. */
export async function recordMaintenance(fd: FormData) {
  const supabase = createClient();
  const deviceId = req(fd, "device_id");
  const nextDue = str(fd, "next_due_date");

  const { error } = await supabase.from("maintenance_logs").insert({
    device_id: deviceId,
    performed_on: str(fd, "performed_on") ?? localDate(),
    performed_by: str(fd, "performed_by"),
    description: str(fd, "description"),
    cost: num(fd, "cost"),
    next_due_date: nextDue,
  });
  if (error) return formError(error);

  // move the device back to "installed" and update its next maintenance date
  await supabase
    .from("devices")
    .update({
      status: "installed",
      next_maintenance_date: nextDue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deviceId);

  revalidatePath("/devices");
  revalidatePath("/");
  redirect("/devices?saved=created");
}

// =========================================================================
// Kit batches
// =========================================================================
export async function createKitBatch(fd: FormData) {
  const supabase = createClient();
  const qty = num(fd, "qty_received");
  const { error } = await supabase.from("kit_batches").insert({
    batch_no: req(fd, "batch_no"),
    product_id: req(fd, "product_id"),
    warehouse_id: str(fd, "warehouse_id"),
    supplier_id: str(fd, "supplier_id"),
    manufacturing_date: str(fd, "manufacturing_date"),
    expiry_date: str(fd, "expiry_date"),
    qty_received: qty,
    qty_available: qty, // starts full
    buy_price: num(fd, "buy_price"),
    sell_price: num(fd, "sell_price"),
  });
  if (error) return formError(error);
  revalidatePath("/kits");
  redirect("/kits?saved=created");
}

export async function updateKitBatch(id: string, fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("kit_batches")
    .update({
      expiry_date: str(fd, "expiry_date"),
      qty_available: num(fd, "qty_available"),
      buy_price: num(fd, "buy_price"),
      sell_price: num(fd, "sell_price"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return formError(error);
  revalidatePath("/kits");
  redirect("/kits?saved=created");
}

// =========================================================================
// Movements & sales (FormData wrappers around the business logic)
// =========================================================================
export async function submitWithdrawal(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("stock_movements").insert({
    kit_batch_id: req(fd, "kit_batch_id"),
    lab_id: req(fd, "lab_id"),
    type: "withdrawal",
    qty: num(fd, "qty"),
    buy_price: num(fd, "buy_price"),
    sell_price: num(fd, "sell_price"),
    note: str(fd, "note"),
  });
  if (error) return formError(error);
  revalidatePath("/kits");
  revalidatePath("/labs");
  revalidatePath("/");
  redirect("/kits?saved=created");
}

export async function submitSale(fd: FormData) {
  await assertFeature("Selling");
  const supabase = createClient();
  // Route the "Record Sale" form through the SAME idempotent, cost-authoritative
  // checkout as the POS terminal, so every sales path books identically: the
  // customer and product are validated, and the COST is always re-read from the
  // product on the server (never taken from the form).
  const { error } = await supabase.rpc("fn_pos_checkout", {
    p_request_id: randomUUID(),
    p_lab_id: req(fd, "lab_id"),
    p_lines: JSON.stringify([
      { product_id: req(fd, "product_id"), qty: num(fd, "qty"), sell_price: num(fd, "sell_price") },
    ]),
  });
  if (error) return formError(error);
  revalidatePath("/");
  revalidatePath("/reports/sales-by-product");
  redirect("/");
}

// =========================================================================
// Master data — ported from ERPNext Item / Warehouse / Supplier DocTypes
// =========================================================================

// Products  <- ERPNext "Item"
export async function createProduct(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("products").insert({
    item_code: req(fd, "item_code"),
    name: req(fd, "name"),
    product_type: req(fd, "product_type"),
    item_group: str(fd, "item_group"),
    brand: str(fd, "brand"),
    uom: str(fd, "uom") ?? "Nos",
    supplier_id: str(fd, "supplier_id"),
    shelf_life_in_days: str(fd, "shelf_life_in_days")
      ? num(fd, "shelf_life_in_days")
      : null,
    default_buy_price: num(fd, "default_buy_price"),
    default_sell_price: num(fd, "default_sell_price"),
    reorder_level: num(fd, "reorder_level"),
    description: str(fd, "description"),
  });
  if (error) return formError(error);
  revalidatePath("/products");
  redirect("/products?saved=created");
}

export async function updateProduct(id: string, fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: req(fd, "name"),
      item_group: str(fd, "item_group"),
      brand: str(fd, "brand"),
      uom: str(fd, "uom") ?? "Nos",
      supplier_id: str(fd, "supplier_id"),
      shelf_life_in_days: str(fd, "shelf_life_in_days")
        ? num(fd, "shelf_life_in_days")
        : null,
      default_buy_price: num(fd, "default_buy_price"),
      default_sell_price: num(fd, "default_sell_price"),
      reorder_level: num(fd, "reorder_level"),
      description: str(fd, "description"),
      is_disabled: bool(fd, "is_disabled"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return formError(error);
  revalidatePath("/products");
  redirect("/products?saved=created");
}

// Warehouses  <- ERPNext "Warehouse"
export async function createWarehouse(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("warehouses").insert({
    name: req(fd, "name"),
    warehouse_type: str(fd, "warehouse_type"),
    city: str(fd, "city"),
    address: str(fd, "address"),
    phone: str(fd, "phone"),
  });
  if (error) return formError(error);
  revalidatePath("/warehouses");
  redirect("/warehouses?saved=created");
}

// Companies  <- ERPNext "Supplier"
export async function createCompany(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("companies").insert({
    name: req(fd, "name"),
    role: str(fd, "role") ?? "supplier",
    supplier_type: str(fd, "supplier_type") ?? "company",
    supplier_group: str(fd, "supplier_group"),
    tax_id: str(fd, "tax_id"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    country: str(fd, "country"),
  });
  if (error) return formError(error);
  revalidatePath("/companies");
  redirect("/companies?saved=created");
}
