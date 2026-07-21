import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { submitAssetMovementForm, cancelAssetMovementForm } from "@/app/actions/asset_movement";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  movement_no: string;
  purpose: string;
  status: string;
  transaction_date: string;
  asset_movement_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};
const purposeBadge: Record<string, string> = {
  issue: "bg-amber-100 text-amber-700",
  receipt: "bg-blue-100 text-blue-700",
  transfer: "bg-violet-100 text-violet-700",
};

export default async function AssetMovementsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_movements")
    .select("id, movement_no, purpose, status, transaction_date, asset_movement_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Asset Movements")}</h1>
        <div className="flex gap-2">
          <Link href="/devices" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Devices</Link>
          <Link href="/asset-movements/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New movement</Link>
        </div>
      </div>

      <Panel title={`${t(locale, "Movements")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No movements yet — relocate devices between labs and warehouses")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Movement no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Purpose")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Devices")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-medium">{m.movement_no}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${purposeBadge[m.purpose] ?? "bg-surface-gray-2"}`}>
                        {m.purpose}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{new Date(m.transaction_date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{m.asset_movement_items?.length ?? 0}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[m.status] ?? "bg-surface-gray-2"}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {m.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitAssetMovementForm}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                          </form>
                          <form action={cancelAssetMovementForm}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
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
