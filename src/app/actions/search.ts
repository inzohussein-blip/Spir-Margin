"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessContext, isPathAllowed } from "@/lib/features";

export interface SearchHit {
  entity: string;
  entityLabel: string;
  label: string;
  sublabel: string | null;
  href: string;
}

const ENTITY: Record<string, { label: string; href: (id: string) => string }> = {
  lab: { label: "Lab", href: () => "/labs" },
  product: { label: "Product", href: () => "/products" },
  company: { label: "Supplier", href: () => "/companies" },
  device: { label: "Device", href: () => "/devices" },
  sales_invoice: { label: "Invoice", href: (id) => `/sales-invoices/${id}` },
  purchase_order: { label: "Purchase Order", href: (id) => `/purchase-orders/${id}` },
  issue: { label: "Issue", href: (id) => `/issues/${id}` },
};

interface Row { entity: string; record_id: string; label: string; sublabel: string | null; }

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Only signed-in users may search, and results are limited to features the
  // account may actually open (a hidden/denied module leaks nothing here).
  const user = await getCurrentUser();
  if (!user) return [];
  const ctx = await getAccessContext(user);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_global_search", { p_q: q });
  if (error) return [];
  return ((data as unknown as Row[]) ?? [])
    .map((r) => {
      const meta = ENTITY[r.entity] ?? { label: r.entity, href: () => "/" };
      return { entity: r.entity, entityLabel: meta.label, label: r.label, sublabel: r.sublabel, href: meta.href(r.record_id) };
    })
    .filter((hit) => isPathAllowed(hit.href, ctx));
}
