import "server-only";
import { createClient } from "@/lib/supabase/server";
import { t, type Locale } from "@/lib/i18n";
import { localDate } from "@/lib/dates";

export interface Notif {
  title: string;
  sub: string;
  href: string;
  severity: "red" | "amber" | "blue";
}

interface KitRow { product_name: string; days_until_expiry: number }
interface MaintRow { asset_code: string; lab_name: string | null; days_until_due: number }
interface ContractRow { contract_no: string; lab_name: string | null; days_left: number }
interface InvRow { invoice_no: string; outstanding: number; due_date: string | null; labs: { name: string } | null }
interface ReorderRow { product_name: string; on_hand: number; reorder_level: number }

/** Urgent operational alerts for the navbar bell (reuses existing views). */
export async function getNotifications(locale: Locale): Promise<Notif[]> {
  const supabase = createClient();
  const today = localDate();
  const [kitsRes, maintRes, contractsRes, invRes, reorderRes] = await Promise.all([
    supabase.from("v_expiring_kits").select("product_name, days_until_expiry").lte("days_until_expiry", 30),
    supabase.from("v_maintenance_alerts").select("asset_code, lab_name, days_until_due").lte("days_until_due", 7),
    supabase.from("v_expiring_contracts").select("contract_no, lab_name, days_left").lte("days_left", 30),
    supabase.from("sales_invoices").select("invoice_no, outstanding, due_date, labs(name)").neq("status", "cancelled").gt("outstanding", 0),
    supabase.from("v_reorder_suggestions").select("product_name, on_hand, reorder_level"),
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
    out.push({ title: `${c.contract_no}${c.lab_name ? " · " + c.lab_name : ""}`, sub: `${t(locale, "contract expiring")} · ${d(Number(c.days_left))}`, href: `/contracts?q=${encodeURIComponent(c.contract_no)}`, severity: "blue" });
  }
  // Overdue invoices, one line per lab: who to call, how many, how much.
  const overdue = (invRes.data as unknown as InvRow[] ?? []).filter((i) => i.due_date && i.due_date < today);
  const byLab = new Map<string, { n: number; amount: number; first: string }>();
  for (const i of overdue) {
    const lab = i.labs?.name ?? "—";
    const g = byLab.get(lab) ?? { n: 0, amount: 0, first: i.invoice_no };
    g.n += 1;
    g.amount += Number(i.outstanding) || 0;
    byLab.set(lab, g);
  }
  for (const [lab, g] of [...byLab].sort((a, b) => b[1].amount - a[1].amount).slice(0, 6)) {
    out.push({
      title: lab,
      sub: `${g.n} ${t(locale, "overdue invoice(s)")} · ${g.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      href: g.n === 1 ? `/sales-invoices?q=${encodeURIComponent(g.first)}` : "/reports/receivables",
      severity: "red",
    });
  }

  // Below the reorder level: one line, to the page that raises the orders.
  const short = (reorderRes.data as unknown as ReorderRow[]) ?? [];
  if (short.length) {
    out.push({
      title: short.length === 1 ? short[0].product_name : `${short.length} ${t(locale, "products below their reorder level")}`,
      sub: short.length === 1
        ? `${t(locale, "on hand")} ${Number(short[0].on_hand)} / ${Number(short[0].reorder_level)}`
        : short.slice(0, 3).map((r) => r.product_name).join("، "),
      href: "/reorder",
      severity: "amber",
    });
  }
  return out;
}
