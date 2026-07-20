import "server-only";
import { createClient } from "@/lib/supabase/server";
import { t, type Locale } from "@/lib/i18n";

export interface Notif {
  title: string;
  sub: string;
  href: string;
  severity: "red" | "amber" | "blue";
}

interface KitRow { product_name: string; days_until_expiry: number }
interface MaintRow { asset_code: string; lab_name: string | null; days_until_due: number }
interface ContractRow { contract_no: string; lab_name: string | null; days_left: number }
interface InvRow { invoice_no: string; outstanding: number; due_date: string | null }

/** Urgent operational alerts for the navbar bell (reuses existing views). */
export async function getNotifications(locale: Locale): Promise<Notif[]> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [kitsRes, maintRes, contractsRes, invRes] = await Promise.all([
    supabase.from("v_expiring_kits").select("product_name, days_until_expiry").lte("days_until_expiry", 30),
    supabase.from("v_maintenance_alerts").select("asset_code, lab_name, days_until_due").lte("days_until_due", 7),
    supabase.from("v_expiring_contracts").select("contract_no, lab_name, days_left").lte("days_left", 30),
    supabase.from("sales_invoices").select("invoice_no, outstanding, due_date").neq("status", "cancelled").gt("outstanding", 0),
  ]);

  const d = (n: number) => `${n} ${t(locale, "days")}`;
  const out: Notif[] = [];

  for (const k of (kitsRes.data as unknown as KitRow[] ?? []).slice(0, 6)) {
    out.push({ title: k.product_name, sub: `${t(locale, "kit expiring")} · ${d(Number(k.days_until_expiry))}`, href: "/kits", severity: Number(k.days_until_expiry) <= 7 ? "red" : "amber" });
  }
  for (const m of (maintRes.data as unknown as MaintRow[] ?? []).slice(0, 6)) {
    out.push({ title: `${m.asset_code}${m.lab_name ? " · " + m.lab_name : ""}`, sub: `${t(locale, "maintenance due")} · ${d(Number(m.days_until_due))}`, href: "/maintenance-schedules", severity: "amber" });
  }
  for (const c of (contractsRes.data as unknown as ContractRow[] ?? []).slice(0, 6)) {
    out.push({ title: `${c.contract_no}${c.lab_name ? " · " + c.lab_name : ""}`, sub: `${t(locale, "contract expiring")} · ${d(Number(c.days_left))}`, href: "/contracts", severity: "blue" });
  }
  const overdue = (invRes.data as unknown as InvRow[] ?? []).filter((i) => i.due_date && i.due_date < today);
  for (const i of overdue.slice(0, 6)) {
    out.push({ title: i.invoice_no, sub: t(locale, "overdue invoice"), href: "/sales-invoices", severity: "red" });
  }
  return out;
}
