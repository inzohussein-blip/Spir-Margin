import Link from "next/link";
import { ThermometerIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { saveReadings } from "@/app/actions/coldchain";
import { addDays, inRange, SLOTS, todayStatus } from "@/lib/coldchain/core";
import { CcTabs, KIND_LABEL, ccReadings, ccUnits, fmtT } from "@/components/coldchain/parts";

export const dynamic = "force-dynamic";

/** The day's temperature sheet: every fridge and store, morning and evening. */
export default async function TemperaturesPage({ searchParams }: { searchParams?: { date?: string } }) {
  const locale = getLocale();
  const today = localDate();
  const date = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : today;
  const [units, readings] = await Promise.all([ccUnits(true), ccReadings(date, date)]);
  const hour = new Date().getHours();
  const { due, alarms } = todayStatus(units, readings, date, hour < 13 ? "AM" : "PM");
  const cell = (u: string, s: string) => readings.find((r) => r.unit_id === u && r.slot === s);

  return (
    <div className="space-y-5">
      <CcTabs active="/cold-chain/temperatures" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Temperatures")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/cold-chain/temperatures?date=${addDays(date, -1)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous day")}</Link>
          <span className="rounded-md bg-surface-gray-1 px-3 py-1.5 font-semibold tabular-nums" dir="ltr">{date}</span>
          <Link href={`/cold-chain/temperatures?date=${addDays(date, 1)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next day")}</Link>
          {date !== today && <Link href="/cold-chain/temperatures" className="text-brand hover:underline">{t(locale, "Today")}</Link>}
        </div>
      </div>

      {date === today && units.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm" data-testid="cc-status">
          <span className={`rounded-lg border px-3 py-1.5 ${due.length ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {due.length ? `${t(locale, "Readings still to take")}: ${due.length}` : t(locale, "All of this period's readings are taken")}
          </span>
          {alarms.length > 0 && (
            <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700" data-testid="cc-alarm">
              {t(locale, "Out of range with no action written")}: {alarms.length}
            </span>
          )}
        </div>
      )}

      <Panel title={t(locale, "The day's sheet")}>
        {units.length === 0 ? (
          <EmptyRow icon={<ThermometerIcon size={20} />} text={t(locale, "No fridges or stores yet")} hint={t(locale, "Add each fridge, freezer and store room with its safe range.")} actionHref="/cold-chain/units" actionLabel={t(locale, "Add a fridge or store")} />
        ) : (
          <ValidatedForm action={saveReadings} className="space-y-3 p-2">
            <input type="hidden" name="date" value={date} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="cc-sheet">
                <thead><tr className="text-xs text-ink-gray-4">
                  <th className="px-2 py-2 text-start">{t(locale, "Fridge or store")}</th>
                  <th className="px-2 py-2 text-start">{t(locale, "Safe range")}</th>
                  {SLOTS.map((s) => <th key={s} className="px-2 py-2 text-start">{t(locale, s === "AM" ? "Morning" : "Evening")}</th>)}
                  <th className="px-2 py-2 text-start">{t(locale, "Month sheet")}</th>
                </tr></thead>
                <tbody className="divide-y divide-outline-gray-1">
                  {units.map((u) => (
                    <tr key={u.id} data-unit={u.name}>
                      <td className="px-2 py-2 font-medium">
                        <input type="hidden" name="unit" value={u.id} />
                        {u.name} <span className="text-xs text-ink-gray-5">({t(locale, KIND_LABEL[u.kind] ?? "Other")})</span>
                      </td>
                      <td className="px-2 py-2 tabular-nums text-ink-gray-6" dir="ltr">{fmtT(u.min_temp)} … {fmtT(u.max_temp)}</td>
                      {SLOTS.map((s) => {
                        const r = cell(u.id, s);
                        const bad = r ? !inRange(u, r.value) : false;
                        return (
                          <td key={s} className="px-2 py-2 align-top">
                            <input type="hidden" name={`was:${u.id}:${s}`} value={r ? String(r.value) : ""} />
                            <input type="hidden" name={`wasa:${u.id}:${s}`} value={r?.action ?? ""} />
                            <input name={`v:${u.id}:${s}`} defaultValue={r ? String(r.value) : ""} inputMode="decimal" dir="ltr" aria-label={`${u.name} ${s}`}
                              className={`w-20 rounded-md border px-2 py-1 text-center tabular-nums ${bad ? "border-red-400 bg-red-50 text-red-700" : "border-outline-gray-2"}`} data-bad={bad ? "1" : undefined} />
                            {bad && (
                              <input name={`a:${u.id}:${s}`} defaultValue={r?.action ?? ""} placeholder={t(locale, "What was done")}
                                className="mt-1 block w-40 rounded-md border border-red-300 px-2 py-1 text-xs" />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2"><Link href={`/cold-chain/temperatures/${u.id}?month=${date.slice(0, 7)}`} className="text-brand hover:underline">{t(locale, "Open")}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">{t(locale, "Save the readings")}</button>
          </ValidatedForm>
        )}
      </Panel>
    </div>
  );
}
