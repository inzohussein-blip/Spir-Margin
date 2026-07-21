import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { convertLeadForm } from "@/app/actions/crm";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  lead_name: string;
  company_name: string | null;
  status: string;
  city: string | null;
  territory: string | null;
  mobile_no: string | null;
  converted_lab_id: string | null;
}

const statusBadge: Record<string, string> = {
  lead: "bg-surface-gray-2 text-ink-gray-6",
  open: "bg-blue-100 text-blue-700",
  interested: "bg-amber-100 text-amber-700",
  opportunity: "bg-amber-100 text-amber-700",
  converted: "bg-emerald-100 text-emerald-700",
  do_not_contact: "bg-red-100 text-red-700",
};

export default async function LeadsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, lead_name, company_name, status, city, territory, mobile_no, converted_lab_id")
    .order("created_at", { ascending: false });
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Leads")}</h1>
        <Link href="/leads/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + New lead
        </Link>
      </div>
      <Panel title={`${t(locale, "Pipeline")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No leads — track prospective labs before they convert")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Name")}</th>
                  <th className="px-4 py-2">{t(locale, "Company")}</th>
                  <th className="px-4 py-2">{t(locale, "City")}</th>
                  <th className="px-4 py-2">{t(locale, "Territory")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 font-medium"><Link href={`/leads/${l.id}`} className="text-brand hover:underline">{l.lead_name}</Link></td>
                    <td className="px-4 py-2">{l.company_name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{l.city ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{l.territory ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[l.status] ?? "bg-surface-gray-2"}`}>
                        {l.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {l.converted_lab_id ? (
                        <span className="text-xs text-emerald-600">→ lab</span>
                      ) : (
                        <form action={convertLeadForm}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Convert to lab")}</button>
                        </form>
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
