import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PortalShell } from "@/components/portal/PortalShell";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { createPortalTicket } from "@/app/actions/portal";
import { getLocale } from "@/lib/i18n-server";
import { t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Issue { id: string; issue_no: string; subject: string; status: string; opening_date: string | null; created_at: string; }

const cls = "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export default async function PortalTicketsPage() {
  const locale = getLocale() as Locale;
  const user = await getCurrentUser();
  if (!user || user.role !== "customer" || !user.lab_id) redirect("/login");
  const labId = user.lab_id;

  const supabase = createClient();
  const [{ data: labData }, { data: issueData }] = await Promise.all([
    supabase.from("labs").select("name").eq("id", labId).single(),
    supabase.from("issues").select("id, issue_no, subject, status, opening_date, created_at").eq("lab_id", labId).order("created_at", { ascending: false }),
  ]);
  const labName = (labData as { name: string } | null)?.name ?? "";
  const issues = (issueData as unknown as Issue[]) ?? [];

  return (
    <PortalShell labName={labName} active="tickets">
      <div className="space-y-6">
        <Panel title={t(locale, "Open a fault ticket")}>
          <form action={createPortalTicket} className="space-y-3 p-4">
            <label className="block text-sm">
              <span className="font-medium text-ink-gray-8">{t(locale, "Subject")}</span>
              <input name="subject" required className={cls} placeholder={t(locale, "e.g. Analyzer error on startup")} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink-gray-8">{t(locale, "Problem description")}</span>
              <textarea name="description" rows={3} className={cls} />
            </label>
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {t(locale, "Submit ticket")}
            </button>
          </form>
        </Panel>

        <Panel title={`${t(locale, "My tickets")} (${issues.length})`}>
          {issues.length === 0 ? (
            <EmptyRow text={t(locale, "No tickets yet.")} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Issue no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Subject")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {issues.map((i) => (
                  <tr key={i.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{i.issue_no}</td>
                    <td className="px-4 py-2">{i.subject}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{(i.opening_date ?? i.created_at)?.slice(0, 10)}</td>
                    <td className="px-4 py-2"><Indicator status={i.status} locale={locale} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
