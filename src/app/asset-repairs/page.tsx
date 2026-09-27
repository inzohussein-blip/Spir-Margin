import { ValidatedForm } from "@/components/form/ValidatedForm";
import { listWindow, ListFooter, type ListQuery } from "@/components/desk/ListPaging";
import { ListSearch } from "@/components/desk/ListSearch";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
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

export default async function AssetRepairsPage({ searchParams }: { searchParams?: ListQuery }) {
  const locale = getLocale();
  const supabase = createClient();
  const { page, from, to, q } = listWindow(searchParams);
  const { data, count } = await supabase
    .from("asset_repairs")
    .select("id, repair_no, status, failure_date, completion_date, repair_cost, description, devices(asset_code, products(name))", { count: "exact" }).search(["repair_no", "description"], q)
    .order("failure_date", { ascending: false }).range(from, to);
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;
  // The cards cover every repair, not just this page.
  const { data: allData } = await supabase.from("asset_repairs").select("status, repair_cost");
  const all = (allData as { status: string; repair_cost: number }[]) ?? [];
  const pending = all.filter((r) => r.status === "pending").length;
  const cost = all.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.repair_cost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Asset Repairs")}</h1>
        <div className="flex gap-2">
          <Link href="/devices" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Devices")}</Link>
          <Link href="/asset-repairs/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"><PlusIcon size={15} /> {t(locale, "New repair")}</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Pending")} value={String(pending)} accent="amber" />
        <StatCard label={t(locale, "Completed cost")} value={cost.toLocaleString("en-US")} accent="green" />
        <StatCard label={t(locale, "Total")} value={String(all.length)} accent="brand" />
      </div>

      <Panel title={`${t(locale, "Repairs")} (${total})`}>
        <ListSearch basePath="/asset-repairs" q={q} />
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
                    <td className="px-4 py-2 font-medium"><Link href={`/asset-repairs/${r.id}`} className="text-brand hover:underline">{r.repair_no}</Link></td>
                    <td className="px-4 py-2">
                      {r.devices?.asset_code ?? "—"}
                      {r.devices?.products?.name ? <span className="text-ink-gray-4"> · {r.devices.products.name}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.description ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.failure_date}</td>
                    <td className="px-4 py-2">{Number(r.repair_cost).toLocaleString("en-US")}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? "bg-surface-gray-2"}`}>
                        {statusLabel(locale, r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "pending" ? (
                        <div className="flex gap-2">
                          <ValidatedForm action={completeAssetRepairForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Complete")}</button>
                          </ValidatedForm>
                          <ValidatedForm action={cancelAssetRepairForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </ValidatedForm>
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
        <ListFooter basePath="/asset-repairs" page={page} total={total} q={q} />
      </Panel>
    </div>
  );
}
