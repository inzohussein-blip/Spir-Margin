"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface BundleLineInput {
  component_id: string;
  qty: number;
  rate: number;
  uom?: string;
}
export interface ProductBundleInput {
  product_id: string;
  description?: string;
  is_active?: boolean;
  items: BundleLineInput[];
}

/** Create a product bundle with its component rows. */
export async function saveProductBundle(input: ProductBundleInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.component_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one component" };
  if (!input.product_id) return { ok: false as const, error: "Bundle product is required" };

  const { data: header, error: hErr } = await supabase
    .from("product_bundles")
    .insert({
      product_id: input.product_id,
      description: input.description || null,
      is_active: input.is_active ?? true,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    bundle_id: header.id,
    component_id: l.component_id,
    qty: Number(l.qty),
    rate: Number(l.rate) || 0,
    uom: l.uom || null,
  }));
  const { error: iErr } = await supabase.from("product_bundle_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/product-bundles");
  return { ok: true as const, bundleId: header.id };
}

export async function deleteProductBundleForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("product_bundles").delete().eq("id", String(fd.get("id")));
  revalidatePath("/product-bundles");
}
