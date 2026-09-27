import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Reading, Unit } from "@/lib/coldchain/core";

export const CC_PAGES: [string, string][] = [
  ["/cold-chain/temperatures", "Temperatures"],
  ["/cold-chain/units", "Fridges & stores"],
  ["/cold-chain/equipment", "Instruments & calibration"],
];

export function CcTabs({ active }: { active: string }) {
  const locale = getLocale();
  return (
    <nav className="no-print -mx-1 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={t(locale, "Cold chain & calibration")}>
      {CC_PAGES.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${href === active ? "bg-cyan-600 text-white" : "text-ink-gray-6 hover:bg-surface-gray-2"}`}>
          {t(locale, label)}
        </Link>
      ))}
    </nav>
  );
}

export const KIND_LABEL: Record<string, string> = { fridge: "Fridge", freezer: "Freezer", room: "Store room", incubator: "Incubator", other: "Other" };

export async function ccUnits(activeOnly = false): Promise<Unit[]> {
  let q = createClient().from("cc_storage_units").select("id, name, kind, min_temp, max_temp, is_active").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return ((data as Unit[] | null) ?? []).map((u) => ({ ...u, min_temp: Number(u.min_temp), max_temp: Number(u.max_temp) }));
}

export async function ccReadings(from: string, to: string, unit?: string): Promise<Reading[]> {
  let q = createClient().from("cc_readings").select("unit_id, reading_date, slot, value, action, recorded_by")
    .gte("reading_date", from).lte("reading_date", to);
  if (unit) q = q.eq("unit_id", unit);
  const { data } = await q;
  return ((data as Reading[] | null) ?? []).map((r) => ({ ...r, value: Number(r.value), reading_date: String(r.reading_date).slice(0, 10) }));
}

export const fmtT = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}°`;
