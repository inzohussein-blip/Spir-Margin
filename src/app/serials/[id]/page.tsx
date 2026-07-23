import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { t, tStatus, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Serial {
  id: string; serial_no: string; status: string; maintenance_status: string | null;
  warehouse_id: string | null; lab_id: string | null; device_id: string | null;
  batch_no: string | null; purchase_rate: number; warranty_expiry_date: string | null;
  created_at: string;
  products: { name: string; item_code: string } | null;
  warehouses: { name: string } | null;
  labs: { name: string } | null;
  devices: { asset_code: string } | null;
}
interface Audit {
  action: "INSERT" | "UPDATE" | "DELETE";
  actor: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
}

/** Turn the immutable audit rows for this serial into human lifecycle events. */
function buildTimeline(
  rows: Audit[],
  wh: Map<string, string>,
  labs: Map<string, string>,
  locale: Locale,
): { at: string; actor: string | null; text: string; tone: string }[] {
  const name = (m: Map<string, string>, id: unknown) => (id ? m.get(String(id)) ?? String(id).slice(0, 8) : null);
  const out: { at: string; actor: string | null; text: string; tone: string }[] = [];
  for (const r of rows) {
    const base = { at: r.changed_at, actor: r.actor };
    if (r.action === "INSERT") {
      const w = name(wh, r.new_data?.warehouse_id);
      out.push({ ...base, tone: "green", text: t(locale, "Received into stock") + (w ? ` — ${w}` : "") });
      continue;
    }
    if (r.action === "DELETE") {
      out.push({ ...base, tone: "red", text: t(locale, "Serial removed") });
      continue;
    }
    const cf = r.changed_fields ?? [];
    const known = ["warehouse_id", "lab_id", "device_id", "status", "maintenance_status"];
    if (cf.includes("warehouse_id") && r.new_data?.warehouse_id) {
      out.push({ ...base, tone: "brand", text: `${t(locale, "Moved to warehouse")} — ${name(wh, r.new_data.warehouse_id)}` });
    }
    if (cf.includes("lab_id")) {
      out.push(r.new_data?.lab_id
        ? { ...base, tone: "amber", text: `${t(locale, "Delivered to lab")} — ${name(labs, r.new_data.lab_id)}` }
        : { ...base, tone: "brand", text: t(locale, "Returned from lab") });
    }
    if (cf.includes("device_id")) {
      out.push({ ...base, tone: "brand", text: r.new_data?.device_id ? t(locale, "Installed into a device") : t(locale, "Removed from a device") });
    }
    if (cf.includes("status")) {
      out.push({ ...base, tone: "gray", text: `${t(locale, "Status changed to")} ${tStatus(locale, String(r.new_data?.status ?? ""))}` });
    }
    if (cf.includes("maintenance_status")) {
      out.push({ ...base, tone: "amber", text: `${t(locale, "Maintenance/warranty status")}: ${String(r.new_data?.maintenance_status ?? "—")}` });
    }
    if (!cf.some((f) => known.includes(f))) {
      out.push({ ...base, tone: "gray", text: `${t(locale, "Updated")}: ${cf.join("، ")}` });
    }
  }
  return out.reverse(); // newest first
}

const TONE: Record<string, string> = {
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", brand: "bg-brand", gray: "bg-ink-gray-4",
};

export default async function SerialDetailPage({ params }: { params: { id: string } }) {
  const locale = getLocale() as Locale;
  const supabase = createClient();

  const { data: serialData } = await supabase
    .from("serial_numbers")
    .select("*, products(name, item_code), warehouses(name), labs(name), devices(asset_code)")
    .eq("id", params.id)
    .single();
  const s = serialData as unknown as Serial | null;
  if (!s) notFound();

  const [{ data: auditData }, { data: whData }, { data: labData }] = await Promise.all([
    supabase.from("audit_log").select("action, actor, changed_at, old_data, new_data, changed_fields")
      .eq("table_name", "serial_numbers").eq("record_id", params.id).order("changed_at"),
    supabase.from("warehouses").select("id, name"),
    supabase.from("labs").select("id, name"),
  ]);
  const wh = new Map(((whData as { id: string; name: string }[]) ?? []).map((w) => [w.id, w.name]));
  const labs = new Map(((labData as { id: string; name: string }[]) ?? []).map((l) => [l.id, l.name]));
  const timeline = buildTimeline((auditData as unknown as Audit[]) ?? [], wh, labs, locale);

  const info: [string, string | null][] = [
    [t(locale, "Product"), s.products ? `${s.products.name} (${s.products.item_code})` : null],
    [t(locale, "Current warehouse"), s.warehouses?.name ?? null],
    [t(locale, "Current lab"), s.labs?.name ?? null],
    [t(locale, "Device"), s.devices?.asset_code ?? null],
    [t(locale, "Batch no"), s.batch_no],
    [t(locale, "Warranty expiry date"), s.warranty_expiry_date],
  ];

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5"><Link href="/serials" className="hover:text-brand">← {t(locale, "Serials")}</Link></div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{s.serial_no}</h1>
          <p className="text-sm text-ink-gray-5">{s.products?.name}</p>
        </div>
        <Indicator status={s.status} locale={locale} />
      </div>

      <Panel title={t(locale, "Details")}>
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          {info.map(([k, v]) => (
            <div key={k}><dt className="text-ink-gray-4">{k}</dt><dd className="font-medium text-ink-gray-8">{v || "—"}</dd></div>
          ))}
        </dl>
      </Panel>

      <Panel title={`${t(locale, "Life cycle")} (${timeline.length})`}>
        {timeline.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-gray-4">{t(locale, "No movement history yet.")}</p>
        ) : (
          <ol className="relative space-y-4 p-5 ps-8">
            <span className="absolute bottom-2 top-2 w-px bg-outline-gray-2 start-[13px]" />
            {timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className={`absolute grid size-2.5 place-items-center rounded-full ${TONE[e.tone]} start-[-22px] top-1.5 ring-4 ring-surface-white`} />
                <p className="text-sm font-medium text-ink-gray-8">{e.text}</p>
                <p className="text-xs text-ink-gray-4">
                  {new Date(e.at).toLocaleString()}{e.actor ? ` · ${e.actor}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
