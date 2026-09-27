import Link from "next/link";
import { LogInIcon, LogOutIcon, UsersIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { punch, saveAttendance } from "@/app/actions/hr";
import { hrContext, hrEmployees } from "@/lib/hr/data";
import { addDays, dayStatus, daysInMonth, hoursLabel, monthSummary, type DayStatus } from "@/lib/hr/core";
import { HrTabs, StatusBadge } from "@/components/hr/parts";

export const dynamic = "force-dynamic";

const ymdOk = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const ymOk = (v?: string) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null);

/**
 * The day's attendance — who is on which shift, who has arrived, who is late —
 * with «Arrived» / «Left» for today, a correction form for any day, and the
 * month's summary per person.
 */
export default async function AttendancePage({ searchParams }: { searchParams?: { date?: string; month?: string } }) {
  const locale = getLocale();
  const today = localDate();
  const month = ymOk(searchParams?.month);
  if (month) return <MonthView month={month} />;

  const date = ymdOk(searchParams?.date) ?? today;
  const [people, ctx] = await Promise.all([hrEmployees(true), hrContext(date, date)]);
  const names = new Map(people.map((p) => [p.id, p.full_name]));
  const rows = people.map((p) => ({ p, r: dayStatus(p.id, date, ctx), a: ctx.attendance.find((x) => x.employee_id === p.id) }));
  const count = (s: DayStatus[]) => rows.filter((x) => s.includes(x.r.status)).length;
  const back = `/hr/attendance${date === today ? "" : `?date=${date}`}`;

  return (
    <div className="space-y-5">
      <HrTabs active="/hr/attendance" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Attendance")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/hr/attendance?date=${addDays(date, -1)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous day")}</Link>
          <span className="rounded-md bg-surface-gray-1 px-3 py-1.5 font-semibold tabular-nums" dir="ltr">{date}</span>
          <Link href={`/hr/attendance?date=${addDays(date, 1)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next day")}</Link>
          {date !== today && <Link href="/hr/attendance" className="text-brand hover:underline">{t(locale, "Today")}</Link>}
          <Link href={`/hr/attendance?month=${date.slice(0, 7)}`} className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark">{t(locale, "The month")}</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="attendance-counts">
        {([["Present", ["present", "late"]], ["Late", ["late"]], ["Absent", ["absent"]], ["On leave", ["leave"]]] as [string, DayStatus[]][]).map(([k, s]) => (
          <div key={k} className="rounded-xl border border-outline-gray-2 bg-surface-white p-3">
            <div className="text-xs text-ink-gray-5">{t(locale, k)}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-ink-gray-8">{count(s)}</div>
          </div>
        ))}
      </div>

      <Panel title={`${t(locale, "Staff")} (${people.length})`}>
        {people.length === 0 ? (
          <EmptyRow icon={<UsersIcon size={20} />} text={t(locale, "No employees yet")} hint={t(locale, "Add the company's staff, then put them on shifts in the roster.")} actionHref="/hr/employees/new" actionLabel={t(locale, "New employee")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="attendance-table">
              <thead>
                <tr className="text-start text-xs text-ink-gray-4">
                  <th className="px-3 py-2 text-start">{t(locale, "Employee")}</th>
                  <th className="px-3 py-2 text-start">{t(locale, "Shift")}</th>
                  <th className="px-3 py-2 text-start">{t(locale, "Status")}</th>
                  <th className="px-3 py-2 text-start">{t(locale, "Arrived")}</th>
                  <th className="px-3 py-2 text-start">{t(locale, "Left")}</th>
                  <th className="px-3 py-2 text-start">{t(locale, "Record")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map(({ p, r, a }) => (
                  <tr key={p.id} data-employee={p.full_name}>
                    <td className="px-3 py-2 font-medium">
                      <span className="me-2 inline-block size-2.5 rounded-full align-middle" style={{ background: p.color }} />
                      {p.full_name}
                      {r.covering && <div className="text-xs text-ink-gray-5">{t(locale, "Covering for")} {names.get(r.covering.forId) ?? "—"}</div>}
                      {r.coveredBy && <div className="text-xs text-ink-gray-5">{t(locale, "Covered by")} {names.get(r.coveredBy) ?? "—"}</div>}
                    </td>
                    <td className="px-3 py-2 text-ink-gray-6">{r.shift ? <span dir="auto">{r.shift.name} <span className="tabular-nums text-ink-gray-4" dir="ltr">{r.shift.start_time}–{r.shift.end_time}</span></span> : "—"}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} lateMin={r.lateMin} /></td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">{a?.check_in ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">{a?.check_out ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {date === today && !a?.check_in && r.status !== "leave" && (
                          <ValidatedForm action={punch}>
                            <input type="hidden" name="employee" value={p.id} /><input type="hidden" name="kind" value="in" /><input type="hidden" name="back" value={back} />
                            <button className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"><LogInIcon size={13} /> {t(locale, "Arrived")}</button>
                          </ValidatedForm>
                        )}
                        {date === today && a?.check_in && !a?.check_out && (
                          <ValidatedForm action={punch}>
                            <input type="hidden" name="employee" value={p.id} /><input type="hidden" name="kind" value="out" /><input type="hidden" name="back" value={back} />
                            <button className="inline-flex items-center gap-1 rounded-md bg-slate-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"><LogOutIcon size={13} /> {t(locale, "Left")}</button>
                          </ValidatedForm>
                        )}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-brand hover:underline">{t(locale, "Edit times")}</summary>
                          <ValidatedForm action={saveAttendance} className="mt-2 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="employee" value={p.id} /><input type="hidden" name="date" value={date} /><input type="hidden" name="back" value={back} />
                            <label className="flex flex-col gap-0.5">{t(locale, "Arrived")}<input name="check_in" type="time" defaultValue={a?.check_in ?? ""} className="rounded border border-outline-gray-2 px-1.5 py-1" /></label>
                            <label className="flex flex-col gap-0.5">{t(locale, "Left")}<input name="check_out" type="time" defaultValue={a?.check_out ?? ""} className="rounded border border-outline-gray-2 px-1.5 py-1" /></label>
                            <label className="flex flex-col gap-0.5">{t(locale, "Note")}<input name="note" defaultValue={a?.note ?? ""} className="w-32 rounded border border-outline-gray-2 px-1.5 py-1" /></label>
                            <button className="rounded-md bg-brand px-2.5 py-1 font-semibold text-white hover:bg-brand-dark">{t(locale, "Save")}</button>
                          </ValidatedForm>
                        </details>
                      </div>
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

async function MonthView({ month }: { month: string }) {
  const locale = getLocale();
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const [people, ctx] = await Promise.all([hrEmployees(true), hrContext(`${month}-01`, last)]);
  const prev = addDays(`${month}-01`, -1).slice(0, 7);
  const next = addDays(last, 1).slice(0, 7);
  return (
    <div className="space-y-5">
      <HrTabs active="/hr/attendance" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Attendance for the month")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/hr/attendance?month=${prev}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous month")}</Link>
          <span className="rounded-md bg-surface-gray-1 px-3 py-1.5 font-semibold tabular-nums" dir="ltr">{month}</span>
          <Link href={`/hr/attendance?month=${next}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next month")}</Link>
          <Link href="/hr/attendance" className="text-brand hover:underline">{t(locale, "Today")}</Link>
        </div>
      </div>
      <Panel title={t(locale, "Month summary")}>
        {people.length === 0 ? <EmptyRow text={t(locale, "No employees yet")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="month-table">
              <thead>
                <tr className="text-xs text-ink-gray-4">
                  {["Employee", "Days present", "Late days", "Late (h:mm)", "Absent", "Leave days", "Covered for others", "Hours worked"].map((h) => (
                    <th key={h} className="px-3 py-2 text-start">{t(locale, h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1 tabular-nums">
                {people.map((p) => {
                  const m = monthSummary(p.id, month, ctx);
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-medium">{p.full_name}</td>
                      <td className="px-3 py-2">{m.present}</td>
                      <td className="px-3 py-2">{m.late}</td>
                      <td className="px-3 py-2" dir="ltr">{hoursLabel(m.lateMin)}</td>
                      <td className={`px-3 py-2 ${m.absent ? "font-semibold text-red-600" : ""}`}>{m.absent}</td>
                      <td className="px-3 py-2">{m.leave}</td>
                      <td className="px-3 py-2">{m.covered}</td>
                      <td className="px-3 py-2" dir="ltr">{hoursLabel(m.workedMin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
