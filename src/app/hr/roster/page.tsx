import Link from "next/link";
import { CopyIcon, UsersIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { copyWeek } from "@/app/actions/hr";
import { hrContext, hrEmployees, hrSettings } from "@/lib/hr/data";
import { addDays, leaveOn, weekStartOf } from "@/lib/hr/core";
import { HrTabs } from "@/components/hr/parts";
import { RosterCell } from "@/components/hr/RosterCell";
import { PrintButton } from "@/components/print/PrintButton";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The weekly roster: a shift (or a rest day) per person per day, and who covers whom. */
export default async function RosterPage({ searchParams }: { searchParams?: { week?: string } }) {
  const locale = getLocale();
  const settings = await hrSettings();
  const asked = searchParams?.week && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.week) ? searchParams.week : localDate();
  const start = weekStartOf(asked, settings.week_start);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [people, ctx] = await Promise.all([hrEmployees(true), hrContext(start, days[6])]);
  const shiftOpts = ctx.shifts.map((s) => ({ id: s.id, name: `${s.name} ${s.start_time}–${s.end_time}` }));
  const today = localDate();

  return (
    <div className="space-y-5">
      <HrTabs active="/hr/roster" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Roster")}</h1>
        <div className="no-print flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/hr/roster?week=${addDays(start, -7)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous week")}</Link>
          <span className="rounded-md bg-surface-gray-1 px-3 py-1.5 font-semibold tabular-nums" dir="ltr">{start} → {days[6]}</span>
          <Link href={`/hr/roster?week=${addDays(start, 7)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next week")}</Link>
          <ValidatedForm action={copyWeek}>
            <input type="hidden" name="from" value={addDays(start, -7)} /><input type="hidden" name="to" value={start} />
            <button className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1" data-testid="copy-week">
              <CopyIcon size={14} /> {t(locale, "Copy last week here")}
            </button>
          </ValidatedForm>
          <PrintButton />
        </div>
      </div>

      {ctx.shifts.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t(locale, "There are no shifts yet.")} <Link href="/hr/shifts" className="font-semibold underline">{t(locale, "Add the shifts")}</Link>
        </p>
      )}

      <Panel title={t(locale, "The week")}>
        {people.length === 0 ? (
          <EmptyRow icon={<UsersIcon size={20} />} text={t(locale, "No employees yet")} actionHref="/hr/employees/new" actionLabel={t(locale, "New employee")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm" data-testid="roster-table">
              <thead>
                <tr className="text-xs text-ink-gray-5">
                  <th className="px-2 py-2 text-start">{t(locale, "Employee")}</th>
                  {days.map((d) => (
                    <th key={d} className={`px-2 py-2 text-start ${d === today ? "text-brand" : ""}`}>
                      <div>{t(locale, DAY_NAMES[new Date(d + "T00:00:00Z").getUTCDay()])}</div>
                      <div className="tabular-nums text-ink-gray-4" dir="ltr">{d.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {people.map((p) => (
                  <tr key={p.id} data-employee={p.full_name}>
                    <td className="whitespace-nowrap px-2 py-2 font-medium">
                      <span className="me-1.5 inline-block size-2.5 rounded-full align-middle" style={{ background: p.color }} />{p.full_name}
                    </td>
                    {days.map((d) => {
                      const c = ctx.roster.find((r) => r.employee_id === p.id && r.work_date === d);
                      const leave = leaveOn(ctx.leaves, p.id, d);
                      const shift = ctx.shifts.find((s) => s.id === c?.shift_type_id);
                      return (
                        <td key={d} className="px-1.5 py-1.5 align-top">
                          {leave ? (
                            <span className="block rounded-md bg-sky-50 px-1.5 py-1 text-center text-xs text-sky-700">{t(locale, "On leave")}</span>
                          ) : (
                            <RosterCell
                              employee={p.id} date={d}
                              value={c?.is_off ? "off" : c?.shift_type_id ?? ""}
                              cover={c?.covered_by ?? ""}
                              shifts={shiftOpts}
                              others={people.filter((o) => o.id !== p.id).map((o) => ({ id: o.id, name: o.full_name }))}
                              color={shift?.color}
                            />
                          )}
                        </td>
                      );
                    })}
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
