import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { fmtDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

interface Row {
  id: string; auth_no: string; issue_date: string; valid_to: string; status: string;
  bearer_name: string; from_governorate: string; to_governorate: string;
}

export default async function AuthorizationsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("transport_authorizations")
    .select("id, auth_no, issue_date, valid_to, status, bearer_name, from_governorate, to_governorate")
    .order("issue_date", { ascending: false })
    .limit(200);
  const rows = (data as unknown as Row[]) ?? [];
  const today = localDate();

  return (
    <ListShell
      title={t(locale, "Transport authorisations")}
      count={rows.length}
      newHref="/authorizations/new"
      newLabel={t(locale, "New transport authorisation")}
    >
      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No authorisations issued yet.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Reference")}</th>
                <th className="px-4 py-2">{t(locale, "Date")}</th>
                <th className="px-4 py-2">{t(locale, "Authorised person")}</th>
                <th className="px-4 py-2">{t(locale, "Route")}</th>
                <th className="px-4 py-2">{t(locale, "Valid to")}</th>
                <th className="px-4 py-2">{t(locale, "Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => {
                // An authorisation past its date is spent, whatever the row says.
                const expired = r.status === "issued" && r.valid_to < today;
                const status = r.status === "cancelled" ? "inactive" : expired ? "pending" : "active";
                const label = r.status === "cancelled" ? "cancelled" : expired ? "expired" : "issued";
                return (
                  <tr key={r.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/authorizations/${r.id}`} className="text-brand hover:underline" dir="ltr">
                        {r.auth_no}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{fmtDate(r.issue_date)}</td>
                    <td className="px-4 py-2">{r.bearer_name}</td>
                    <td className="px-4 py-2 text-ink-gray-6">
                      {r.from_governorate} ← {r.to_governorate}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{fmtDate(r.valid_to)}</td>
                    <td className="px-4 py-2"><Indicator status={status} label={t(locale, label)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  );
}
