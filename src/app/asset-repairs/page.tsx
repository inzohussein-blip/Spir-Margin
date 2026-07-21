import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { completeAssetRepairForm, cancelAssetRepairForm } from "@/app/actions/asset_repair";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  repair_no: string;
  status: string;
  failure_date: string;
  completion_date: string | null;
  repair_cost: number;
  description: string | null;
  devices: { asset_code: string; products: { name: string } | null } | null;
}

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function AssetRepairsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_repairs")
    .select("id, repair_no, status, failure_date, completion_date, repair_cost, description, devices(asset_code, products(name))")
    .order("failure_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;
  const cost = rows.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.repair_cost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Asset Repairs")}</h1>
        <div className="flex gap-2">
          <Link href="/devices" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Devices")}</Link>
          <Link href="/asset-repairs/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New repair</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Pending")} value={String(pending)} accent="amber" />
        <StatCard label={t(locale, "Completed cost")} value={cost.toLocaleString()} accent="green" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="brand" />
      </div>

      <Panel title={`${t(locale, "Repairs")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No repairs yet — raise a breakdown repair for a device")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Repair no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Device")}</th>
                  <th className="px-4 py-2">{t(locale, "Problem")}</th>
                  <th className="px-4 py-2">{t(locale, "Failure")}</th>
                  <th className="px-4 py-2">{t(locale, "Cost")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.repair_no}</td>
                    <td className="px-4 py-2">
                      {r.devices?.asset_code ?? "—"}
                      {r.devices?.products?.name ? <span className="text-ink-gray-4"> · {r.devices.products.name}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.description ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.failure_date}</td>
                    <td className="px-4 py-2">{Number(r.repair_cost).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? "bg-surface-gray-2"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "pending" ? (
                        <div className="flex gap-2">
                          <form action={completeAssetRepairForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Complete")}</button>
                          </form>
                          <form action={cancelAssetRepairForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-gray-4">{r.completion_date ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
