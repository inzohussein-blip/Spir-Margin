import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface CompanyRow {
  id: string;
  name: string;
  role: string;
  supplier_type: string | null;
  tax_id: string | null;
  country: string | null;
  phone: string | null;
}

const roleBadge: Record<string, string> = {
  parent: "bg-amber-100 text-amber-700",
  supplier: "bg-blue-100 text-blue-700",
  customer: "bg-emerald-100 text-emerald-700",
};

export default async function CompaniesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, role, supplier_type, tax_id, country, phone")
    .order("name");
  const rows = (data as CompanyRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Companies")}</h1>
        <Link
          href="/companies/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New company
        </Link>
      </div>
      <Panel title={`${t(locale, "Suppliers & partners")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No companies yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Name")}</th>
                  <th className="px-4 py-2">{t(locale, "Role")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "Tax ID")}</th>
                  <th className="px-4 py-2">{t(locale, "Country")}</th>
                  <th className="px-4 py-2">{t(locale, "Phone")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          roleBadge[c.role] ?? "bg-surface-gray-2"
                        }`}
                      >
                        {c.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {c.supplier_type ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {c.tax_id ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {c.country ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{c.phone ?? "—"}</td>
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
