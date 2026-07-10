"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
function nbool(fd: FormData, k: string): boolean {
  return fd.get(k) != null;
}

/** Create an item price (ported from ERPNext "Item Price"). */
export async function createItemPrice(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("item_prices").insert({
    product_id: req(fd, "product_id"),
    price_list: str(fd, "price_list") ?? "Standard Selling",
    selling: nbool(fd, "selling"),
    buying: nbool(fd, "buying"),
    lab_id: str(fd, "lab_id"),
    supplier_id: str(fd, "supplier_id"),
    rate: Number(str(fd, "rate") ?? "0"),
    currency: str(fd, "currency") ?? "USD",
    uom: str(fd, "uom"),
    valid_from: str(fd, "valid_from"),
    valid_upto: str(fd, "valid_upto"),
    note: str(fd, "note"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/prices");
  redirect("/prices");
}
