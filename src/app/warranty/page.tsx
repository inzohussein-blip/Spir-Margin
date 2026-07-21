import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { resolveWarrantyClaimForm } from "@/app/actions/support";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  complaint_date: string;
  status: string;
  complaint: string | null;
  warranty_amc_status: string | null;
  products: { name: string } | null;
  labs: { name: string } | null;
}

const statusBadge: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  work_in_progress: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function WarrantyPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("warranty_claims")
    .select("id, complaint_date, status, complaint, warranty_amc_status, products(name), labs(name)")
    .order("complaint_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Warranty Claims")}</h1>
        <Link href="/warranty/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + New claim
        </Link>
      </div>
      <Panel title={`${t(locale, "All Claims")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No warranty claims")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Complaint")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2 text-ink-gray-5">{w.complaint_date}</td>
                    <td className="px-4 py-2 font-medium">{w.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{w.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-6 max-w-xs truncate">{w.complaint ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[w.status] ?? "bg-surface-gray-2"}`}>
                        {w.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {w.status !== "closed" && w.status !== "cancelled" ? (
                        <form action={resolveWarrantyClaimForm}>
                          <input type="hidden" name="id" value={w.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Resolve")}</button>
                        </form>
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
