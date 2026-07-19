import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { addMasterForm, deleteMasterForm, addTermForm } from "@/app/actions/masters";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Named { id: string; name: string; }
interface Term { id: string; title: string; terms: string | null; }

function NameMaster({ title, table, rows }: { title: string; table: string; rows: Named[] }) {
  const locale = getLocale();
  return (
    <Panel title={`${title} (${rows.length})`}>
      <div className="space-y-2 px-4 py-3">
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "None yet")} />
        ) : (
          <ul className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-ink-gray-8">{r.name}</span>
                <form action={deleteMasterForm}>
                  <input type="hidden" name="table" value={table} />
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-xs text-ink-gray-4 hover:text-red-600">remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addMasterForm} className="flex items-center gap-2 pt-2">
          <input type="hidden" name="table" value={table} />
          <input name="name" placeholder={t(locale, "Add…")} className="flex-1 rounded-md border border-outline-gray-2 px-2 py-1 text-sm" />
          <button className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark">Add</button>
        </form>
      </div>
    </Panel>
  );
}

export default async function MastersPage() {
  const locale = getLocale();
  const supabase = createClient();
  const [{ data: stages }, { data: types }, { data: reasons }, { data: terms }] = await Promise.all([
    supabase.from("sales_stages").select("id, name").order("name"),
    supabase.from("opportunity_types").select("id, name").order("name"),
    supabase.from("opportunity_lost_reasons").select("id, name").order("name"),
    supabase.from("terms_and_conditions").select("id, title, terms").order("title"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Lookup Masters")}</h1>
      <p className="text-sm text-ink-gray-5">Reference lists used across CRM &amp; selling forms.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <NameMaster title={t(locale, "Sales Stages")} table="sales_stages" rows={(stages as Named[]) ?? []} />
        <NameMaster title={t(locale, "Opportunity Types")} table="opportunity_types" rows={(types as Named[]) ?? []} />
        <NameMaster title={t(locale, "Lost Reasons")} table="opportunity_lost_reasons" rows={(reasons as Named[]) ?? []} />
      </div>

      <Panel title={`${t(locale, "Terms & Conditions")} (${(terms as Term[])?.length ?? 0})`}>
        <div className="space-y-3 px-4 py-3">
          {((terms as Term[]) ?? []).map((t) => (
            <div key={t.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-gray-8">{t.title}</span>
                <form action={deleteMasterForm}>
                  <input type="hidden" name="table" value="terms_and_conditions" />
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-xs text-ink-gray-4 hover:text-red-600">remove</button>
                </form>
              </div>
              {t.terms && <p className="mt-1 text-sm text-ink-gray-6">{t.terms}</p>}
            </div>
          ))}
          <form action={addTermForm} className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            <input name="title" placeholder={t(locale, "Title")} className="rounded-md border border-outline-gray-2 px-2 py-1 text-sm" />
            <input name="terms" placeholder={t(locale, "Terms text")} className="rounded-md border border-outline-gray-2 px-2 py-1 text-sm sm:col-span-2" />
            <button className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark sm:col-span-3 sm:w-24">Add term</button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
