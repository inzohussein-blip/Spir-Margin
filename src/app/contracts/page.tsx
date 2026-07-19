import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { setContractStatusForm } from "@/app/actions/contract";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  id: string;
  contract_no: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  contract_value: number;
  labs: { name: string } | null;
  devices: { asset_code: string } | null;
}

const statusBadge: Record<string, string> = {
  unsigned: "bg-surface-gray-2 text-ink-gray-6",
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

function daysLeft(end: string | null) {
  if (!end) return null;
  return Math.round((new Date(end).getTime() - Date.now()) / 86400_000);
}

export default async function ContractsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("contracts")
    .select("id, contract_no, status, start_date, end_date, contract_value, labs(name), devices(asset_code)")
    .order("end_date", { ascending: true });
  const rows = (data as unknown as Row[]) ?? [];
  const active = rows.filter((r) => r.status === "active");
  const expiring = active.filter((r) => {
    const d = daysLeft(r.end_date);
    return d != null && d >= 0 && d <= 60;
  }).length;
  const annualValue = active.reduce((s, r) => s + Number(r.contract_value), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Active")} value={String(active.length)} accent="green" />
        <StatCard label={t(locale, "Expiring ≤ 60d")} value={String(expiring)} accent="amber" />
        <StatCard label={t(locale, "Active value")} value={money(annualValue)} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Service Contracts (AMC)")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "CRM") }]}
        count={rows.length}
        newHref="/contracts/new"
        newLabel={t(locale, "New contract")}
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No contracts yet — add an annual maintenance contract")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "No.")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Device")}</th>
                  <th className="px-4 py-2">{t(locale, "End")}</th>
                  <th className="px-4 py-2">{t(locale, "Value")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((c) => {
                  const d = daysLeft(c.end_date);
                  const soon = c.status === "active" && d != null && d >= 0 && d <= 60;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2 font-medium">{c.contract_no}</td>
                      <td className="px-4 py-2">{c.labs?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{c.devices?.asset_code ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">
                        {c.end_date ?? "—"}
                        {soon ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{d}d</span> : null}
                      </td>
                      <td className="px-4 py-2">{money(Number(c.contract_value))}</td>
                      <td className="px-4 py-2">
                        <form action={setContractStatusForm} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={c.id} />
                          <select name="status" defaultValue={c.status} className="rounded-md border border-outline-gray-2 px-2 py-1 text-xs">
                            <option value="unsigned">unsigned</option>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                          <button className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">Set</button>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[c.status] ?? "bg-surface-gray-2"}`}>{c.status}</span>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ListShell>
    </div>
  );
}
