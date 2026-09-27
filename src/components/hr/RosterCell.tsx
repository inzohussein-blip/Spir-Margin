"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { setCover, setRosterCell } from "@/app/actions/hr";

/**
 * One cell of the weekly roster: the shift, a rest day, or empty — and, for a
 * rostered day, who covers it. Saved as soon as it changes.
 */
export function RosterCell({
  employee, date, value, cover, shifts, others, color,
}: {
  employee: string;
  date: string;
  value: string;
  cover: string;
  shifts: { id: string; name: string }[];
  others: { id: string; name: string }[];
  color?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [v, setV] = useState(value);
  const [c, setC] = useState(cover);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const save = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr("");
      const res = await fn();
      if (res?.error) setErr(res.error);
      router.refresh();
    });

  return (
    <div className={`flex flex-col gap-1 ${pending ? "opacity-60" : ""}`}>
      <select
        aria-label={`${date} ${t(locale, "Shift")}`}
        value={v}
        onChange={(e) => { const nv = e.target.value; setV(nv); if (!nv) setC(""); save(() => setRosterCell(employee, date, nv)); }}
        className="w-full rounded-md border border-outline-gray-2 bg-surface-white px-1.5 py-1 text-xs"
        style={v && v !== "off" && color ? { borderColor: color, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
        data-cell={`${employee}|${date}`}
      >
        <option value="">—</option>
        {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value="off">{t(locale, "Rest day")}</option>
      </select>
      {v && v !== "off" && (
        <select
          aria-label={`${date} ${t(locale, "Covered by")}`}
          value={c}
          onChange={(e) => { const nc = e.target.value; setC(nc); save(() => setCover(employee, date, nc)); }}
          className="w-full rounded-md border border-dashed border-outline-gray-2 bg-surface-white px-1.5 py-0.5 text-[11px] text-ink-gray-6"
        >
          <option value="">{t(locale, "No cover")}</option>
          {others.map((o) => <option key={o.id} value={o.id}>{t(locale, "Covered by")} {o.name}</option>)}
        </select>
      )}
      {err && <span role="alert" className="text-[11px] text-red-600">{t(locale, err)}</span>}
    </div>
  );
}
