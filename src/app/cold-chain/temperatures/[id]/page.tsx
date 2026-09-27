import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { getBranding } from "@/lib/branding";
import { PrintButton } from "@/components/print/PrintButton";
import { addDays, inRange, unitMonth } from "@/lib/coldchain/core";
import { KIND_LABEL, ccReadings, ccUnits, fmtT } from "@/components/coldchain/parts";

export const dynamic = "force-dynamic";

const lastDay = (ym: string) => `${ym}-${String(new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;

/** One fridge's month, printable: the record inspectors ask for. */
export default async function UnitMonthPage({ params, searchParams }: { params: { id: string }; searchParams?: { month?: string } }) {
  const locale = getLocale();
  const today = localDate();
  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : today.slice(0, 7);
  const unit = (await ccUnits()).find((u) => u.id === params.id);
  if (!unit) notFound();
  const [readings, brand] = await Promise.all([ccReadings(`${month}-01`, lastDay(month), unit.id), getBranding()]);
  const m = unitMonth(unit, readings, month, today);
  const prev = addDays(`${month}-01`, -1).slice(0, 7);
  const next = addDays(lastDay(month), 1).slice(0, 7);
  const cell = (r?: { value: number; action?: string | null; recorded_by?: string | null }) =>
    r ? (
      <span className={inRange(unit, r.value) ? "" : "font-bold text-red-600"}>
        {fmtT(r.value)}{r.action ? <span className="block text-[10px] font-normal text-ink-gray-6">{r.action}</span> : null}
      </span>
    ) : <span className="text-ink-gray-4">—</span>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/cold-chain/temperatures" className="text-ink-gray-5 hover:text-brand"><span aria-hidden>→</span> {t(locale, "Temperatures")}</Link>
        <div className="flex items-center gap-2">
          <Link href={`/cold-chain/temperatures/${unit.id}?month=${prev}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous month")}</Link>
          <Link href={`/cold-chain/temperatures/${unit.id}?month=${next}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next month")}</Link>
          <PrintButton />
        </div>
      </div>
      <div className="rounded-lg border border-outline-gray-2 bg-white p-6 print:border-0 print:p-0">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-outline-gray-2 pb-3">
          <div>
            <div className="text-lg font-bold">{brand.companyName || "Spir-Margin"}</div>
            <div className="text-sm text-ink-gray-6">{t(locale, "Temperature record")} — {unit.name} ({t(locale, KIND_LABEL[unit.kind] ?? "Other")})</div>
          </div>
          <div className="text-end text-sm tabular-nums" dir="ltr">
            <div className="font-semibold">{month}</div>
            <div>{fmtT(unit.min_temp)} … {fmtT(unit.max_temp)}</div>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs" data-testid="month-stats">
          <span>{t(locale, "Out of range")}: <b className={m.out ? "text-red-600" : ""}>{m.out}</b></span>
          <span>{t(locale, "Missing readings")}: <b>{m.missing}</b></span>
          {m.min != null && <span dir="ltr">min {fmtT(m.min)} · max {fmtT(m.max!)}</span>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-xs text-ink-gray-5">
            <th className="py-1 text-start">{t(locale, "Date")}</th><th className="py-1 text-start">{t(locale, "Morning")}</th><th className="py-1 text-start">{t(locale, "Evening")}</th>
          </tr></thead>
          <tbody className="divide-y divide-outline-gray-1 tabular-nums">
            {m.rows.map((r) => (
              <tr key={r.date}><td className="py-1" dir="ltr">{r.date.slice(8)}</td><td className="py-1">{cell(r.AM)}</td><td className="py-1">{cell(r.PM)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 flex justify-between text-xs text-ink-gray-6"><span>{t(locale, "Checked by")}: ..................</span><span>{t(locale, "Signature")}: ..................</span></div>
      </div>
    </div>
  );
}
