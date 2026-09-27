import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { addDays, byDay, EVENT_KINDS, monthGrid, spanDays, type CalEvent, type EventKind } from "@/lib/calendar";
import { calibrationDue } from "@/lib/coldchain/core";

export const dynamic = "force-dynamic";

const KIND: Record<EventKind, { label: string; chip: string }> = {
  appointment: { label: "Appointments", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  visit: { label: "Maintenance visits", chip: "bg-teal-50 text-teal-800 border-teal-200" },
  due: { label: "Invoices due", chip: "bg-amber-50 text-amber-900 border-amber-200" },
  expiry: { label: "Kits expiring", chip: "bg-rose-50 text-rose-800 border-rose-200" },
  leave: { label: "Leave", chip: "bg-violet-50 text-violet-800 border-violet-200" },
  calibration: { label: "Calibration due", chip: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  review: { label: "Guide reviews", chip: "bg-indigo-50 text-indigo-800 border-indigo-200" },
};
const DAY_NAMES = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/**
 * The daily calendar (from spir-lab-manager): one month of what is booked or
 * due across the company — appointments, maintenance visits, invoices falling
 * due, kit batches expiring, staff leave, instrument calibrations, guide
 * reviews. Each entry opens its record.
 */
export default async function CalendarPage({ searchParams }: { searchParams?: { month?: string; day?: string } }) {
  const locale = getLocale();
  const today = localDate();
  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : today.slice(0, 7);
  const days = monthGrid(month);
  const from = days[0];
  const to = days[days.length - 1];
  const supabase = createClient();
  const q = <T,>(p: PromiseLike<{ data: unknown }>) => Promise.resolve(p).then((r) => (r.data as T[] | null) ?? []).catch(() => [] as T[]);
  const [appts, visits, dues, kits, leaves, eq, guides] = await Promise.all([
    q<{ id: string; appointment_no: string; scheduled_time: string; contact_name: string | null; labs: { name: string } | null }>(
      supabase.from("appointments").select("id, appointment_no, scheduled_time, contact_name, labs(name)").gte("scheduled_time", `${from}T00:00:00`).lte("scheduled_time", `${to}T23:59:59`)),
    q<{ id: string; visit_no: string; visit_date: string; labs: { name: string } | null }>(
      supabase.from("maintenance_visits").select("id, visit_no, visit_date, labs(name)").gte("visit_date", from).lte("visit_date", to)),
    q<{ id: string; invoice_no: string; due_date: string; outstanding: number; labs: { name: string } | null }>(
      supabase.from("sales_invoices").select("id, invoice_no, due_date, outstanding, labs(name)").gt("outstanding", 0).neq("status", "cancelled").gte("due_date", from).lte("due_date", to)),
    q<{ id: string; batch_no: string; expiry_date: string; products: { name: string } | null }>(
      supabase.from("kit_batches").select("id, batch_no, expiry_date, products(name)").gt("qty_available", 0).gte("expiry_date", from).lte("expiry_date", to)),
    q<{ id: string; from_date: string; to_date: string; hr_employees: { full_name: string } | null }>(
      supabase.from("hr_leaves").select("id, from_date, to_date, hr_employees(full_name)").lte("from_date", to).gte("to_date", from)),
    q<{ id: string; name: string; calib_months: number | null; last_calibrated: string | null }>(
      supabase.from("cc_equipment").select("id, name, calib_months, last_calibrated").eq("is_active", true)),
    q<{ id: string; title: string; next_review: string }>(
      supabase.from("kb_guides").select("id, title, next_review").gte("next_review", from).lte("next_review", to)),
  ]);
  const day = (v: string) => String(v).slice(0, 10);
  const events: CalEvent[] = [
    ...appts.map((a) => ({ date: day(a.scheduled_time), kind: "appointment" as const, title: `${a.labs?.name ?? a.contact_name ?? a.appointment_no}`, href: `/appointments/${a.id}`, time: String(a.scheduled_time).slice(11, 16) })),
    ...visits.map((v) => ({ date: day(v.visit_date), kind: "visit" as const, title: `${v.labs?.name ?? v.visit_no}`, href: `/maintenance-visits/${v.id}` })),
    ...dues.map((d) => ({ date: day(d.due_date), kind: "due" as const, title: `${d.invoice_no} · ${d.labs?.name ?? ""}`, href: `/sales-invoices/${d.id}` })),
    ...kits.map((k) => ({ date: day(k.expiry_date), kind: "expiry" as const, title: `${k.products?.name ?? ""} · ${k.batch_no}`, href: `/kits` })),
    ...leaves.flatMap((l) => spanDays(day(l.from_date), day(l.to_date), from, to).map((d) => ({ date: d, kind: "leave" as const, title: l.hr_employees?.full_name ?? "", href: "/hr/leaves" }))),
    ...eq.flatMap((e) => {
      const c = calibrationDue(e.last_calibrated ? day(e.last_calibrated) : null, e.calib_months, today);
      return c && c.next >= from && c.next <= to ? [{ date: c.next, kind: "calibration" as const, title: e.name, href: `/cold-chain/equipment/${e.id}` }] : [];
    }),
    ...guides.map((g) => ({ date: day(g.next_review), kind: "review" as const, title: g.title, href: `/guides/${g.id}` })),
  ];
  const map = byDay(events);
  const picked = searchParams?.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day) ? searchParams.day : today.startsWith(month) ? today : `${month}-01`;
  const prev = addDays(`${month}-01`, -1).slice(0, 7);
  const next = addDays(`${month}-28`, 7).slice(0, 7);
  const dayList = map.get(picked) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Calendar")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/calendar?month=${prev}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous month")}</Link>
          <span className="rounded-md bg-surface-gray-1 px-3 py-1.5 font-semibold tabular-nums" dir="ltr">{month}</span>
          <Link href={`/calendar?month=${next}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next month")}</Link>
          {!today.startsWith(month) && <Link href="/calendar" className="text-brand hover:underline">{t(locale, "Today")}</Link>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs" data-testid="calendar-legend">
        {EVENT_KINDS.map((k) => <span key={k} className={`rounded-full border px-2 py-0.5 ${KIND[k].chip}`}>{t(locale, KIND[k].label)}</span>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="overflow-x-auto rounded-2xl border border-outline-gray-2 bg-surface-white" data-testid="calendar-grid">
          <div className="grid min-w-[42rem] grid-cols-7 border-b border-outline-gray-2 bg-surface-gray-1 text-center text-xs font-medium text-ink-gray-6">
            {DAY_NAMES.map((d) => <div key={d} className="py-2">{t(locale, d)}</div>)}
          </div>
          <div className="grid min-w-[42rem] grid-cols-7">
            {days.map((d) => {
              const list = map.get(d) ?? [];
              const inMonth = d.startsWith(month);
              return (
                <Link key={d} href={`/calendar?month=${month}&day=${d}`} data-day={d} data-count={list.length}
                  className={`min-h-24 border-b border-e border-outline-gray-1 p-1.5 text-start hover:bg-surface-gray-1 ${inMonth ? "" : "bg-surface-gray-1/50 text-ink-gray-4"} ${d === picked ? "ring-2 ring-inset ring-brand" : ""}`}>
                  <div className={`mb-1 text-xs tabular-nums ${d === today ? "inline-grid size-5 place-items-center rounded-full bg-brand font-bold text-white" : "text-ink-gray-5"}`}>{Number(d.slice(8))}</div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e, i) => (
                      <div key={i} className={`truncate rounded border px-1 py-px text-[10px] ${KIND[e.kind].chip}`} title={`${t(locale, KIND[e.kind].label)}: ${e.title}`}>{e.title}</div>
                    ))}
                    {list.length > 3 && <div className="text-[10px] text-ink-gray-5">+{list.length - 3}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-4" data-testid="calendar-day">
          <div className="mb-3 font-semibold tabular-nums" dir="ltr">{picked}</div>
          {dayList.length === 0 ? <p className="text-sm text-ink-gray-5">{t(locale, "Nothing on this day")}</p> : (
            <ul className="space-y-2">
              {dayList.map((e, i) => (
                <li key={i}>
                  <Link href={e.href} className={`block rounded-lg border px-3 py-2 text-sm hover:opacity-90 ${KIND[e.kind].chip}`}>
                    <div className="text-[11px] opacity-80">{t(locale, KIND[e.kind].label)}{e.time ? <span dir="ltr"> · {e.time}</span> : null}</div>
                    <div className="font-medium">{e.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
