import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, Select, SubmitButton } from "@/components/form/Fields";
import { createUnit, toggleUnit } from "@/app/actions/coldchain";
import { UNIT_KINDS, KIND_RANGE } from "@/lib/coldchain/core";
import { CcTabs, KIND_LABEL, ccUnits, fmtT } from "@/components/coldchain/parts";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const locale = getLocale();
  const [units, wh] = await Promise.all([ccUnits(), createClient().from("warehouses").select("id, name").order("name")]);
  const warehouses = (wh.data as { id: string; name: string }[] | null) ?? [];
  return (
    <div className="space-y-5">
      <CcTabs active="/cold-chain/units" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Fridges & stores")}</h1>
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink-gray-8">{t(locale, "Add a fridge or store")}</h2>
          <ValidatedForm action={createUnit} className="space-y-3">
            <Field label={t(locale, "Name")} required><TextInput name="name" required placeholder={t(locale, "Reagent fridge 1")} /></Field>
            <Field label={t(locale, "Kind")}>
              <Select name="kind" defaultValue="fridge">
                {UNIT_KINDS.map((k) => <option key={k} value={k}>{t(locale, KIND_LABEL[k])} ({KIND_RANGE[k][0]}…{KIND_RANGE[k][1]}°)</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(locale, "Lowest safe °C")} required><TextInput name="min_temp" required inputMode="decimal" defaultValue="2" dir="ltr" /></Field>
              <Field label={t(locale, "Highest safe °C")} required><TextInput name="max_temp" required inputMode="decimal" defaultValue="8" dir="ltr" /></Field>
            </div>
            <Field label={t(locale, "Warehouse")}>
              <Select name="warehouse_id" defaultValue="">
                <option value="">{t(locale, "— none —")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </Field>
            <SubmitButton>{t(locale, "Add")}</SubmitButton>
          </ValidatedForm>
        </div>
        <Panel title={`${t(locale, "Fridges & stores")} (${units.length})`}>
          {units.length === 0 ? <EmptyRow text={t(locale, "No fridges or stores yet")} /> : (
            <ul className="divide-y divide-outline-gray-1" data-testid="unit-list">
              {units.map((u) => (
                <li key={u.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${u.is_active ? "" : "opacity-50"}`}>
                  <span className="flex-1 font-medium">{u.name} <span className="text-xs text-ink-gray-5">({t(locale, KIND_LABEL[u.kind] ?? "Other")})</span></span>
                  <span className="tabular-nums text-ink-gray-6" dir="ltr">{fmtT(u.min_temp)} … {fmtT(u.max_temp)}</span>
                  <ValidatedForm action={toggleUnit}>
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.is_active ? "0" : "1"} />
                    <button className="rounded-md border border-outline-gray-2 px-2 py-1 text-xs hover:bg-surface-gray-1">{t(locale, u.is_active ? "Stop recording" : "Record again")}</button>
                  </ValidatedForm>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
