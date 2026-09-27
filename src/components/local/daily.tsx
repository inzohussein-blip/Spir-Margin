"use client";

import { useState } from "react";
import { LogInIcon, LogOutIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t, tValue } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { useLocalQuery, useRuntime } from "./hooks";
import { Card, SearchBox } from "./parts";

/**
 * The web app's daily screens that are not a plain list: the attendance
 * sheet of a day, the fridges' morning and evening temperatures, and the
 * guides to read — through the same database functions as the installed
 * version (fn_hr_punch, fn_cc_set_reading).
 */

type Row = Record<string, unknown>;
const hhmm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function DayPicker({ day, setDay }: { day: string; setDay: (d: string) => void }) {
  return <input type="date" dir="ltr" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-md border border-outline-gray-2 px-2 py-1 text-sm" />;
}

export function Attendance() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime([]);
  const [day, setDay] = useState(localDate());
  const [err, setErr] = useState("");
  const people = useLocalQuery<Row[]>((c) => c.from("hr_employees").select("id, code, full_name, job_title").eq("is_active", true).order("full_name"), []);
  const marks = useLocalQuery<Row[]>((c) => c.from("hr_attendance").select("employee_id, check_in, check_out").eq("work_date", day), [day]);
  const byPerson = new Map((marks.data ?? []).map((m) => [String(m.employee_id), m]));

  async function punch(id: string, kind: "in" | "out") {
    setErr("");
    await rt.setActor();
    const { error } = await rt.client!.rpc("fn_hr_punch", { p_employee: id, p_date: day, p_kind: kind, p_time: hhmm() });
    if (error) setErr(error.message);
    else rt.afterWrite();
  }

  return (
    <Card title={T("Attendance")} actions={<DayPicker day={day} setDay={setDay} />}>
      {err && <p role="alert" className="px-4 pt-3 text-sm text-red-600">{err}</p>}
      {!people.data?.length ? <p className="p-6 text-center text-sm text-ink-gray-5">{T("Add employees first.")} <a href="#/e/employees/new" className="text-brand">{T("New employee")}</a></p> : (
        <table className="w-full text-sm" data-testid="attendance">
          <thead><tr className="text-xs text-ink-gray-4"><th className="px-4 py-2 text-start font-medium">{T("Employee")}</th><th className="px-4 py-2 text-start font-medium">{T("In")}</th><th className="px-4 py-2 text-start font-medium">{T("Out")}</th><th /></tr></thead>
          <tbody className="divide-y divide-outline-gray-1">
            {people.data.map((p) => {
              const m = byPerson.get(String(p.id));
              return (
                <tr key={String(p.id)} data-employee={String(p.full_name)}>
                  <td className="px-4 py-2"><div className="font-medium">{String(p.full_name)}</div><div className="text-xs text-ink-gray-5">{String(p.job_title ?? "")}</div></td>
                  <td className="px-4 py-2 tabular-nums" dir="ltr" data-in>{String(m?.check_in ?? "—")}</td>
                  <td className="px-4 py-2 tabular-nums" dir="ltr" data-out>{String(m?.check_out ?? "—")}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => void punch(String(p.id), "in")} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><LogInIcon size={13} /> {T("Check in")}</button>
                      <button onClick={() => void punch(String(p.id), "out")} className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-semibold text-ink-gray-7 hover:bg-surface-gray-1"><LogOutIcon size={13} /> {T("Check out")}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function Temperatures() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime([]);
  const [day, setDay] = useState(localDate());
  const [err, setErr] = useState("");
  const units = useLocalQuery<Row[]>((c) => c.from("cc_storage_units").select("id, name, kind, min_temp, max_temp").eq("is_active", true).order("name"), []);
  const reads = useLocalQuery<Row[]>((c) => c.from("cc_readings").select("unit_id, slot, value").eq("reading_date", day), [day]);
  const at = (u: string, slot: string) => (reads.data ?? []).find((r) => String(r.unit_id) === u && r.slot === slot)?.value;

  async function save(u: Row, slot: string, raw: string) {
    setErr("");
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    await rt.setActor();
    const { error } = await rt.client!.rpc("fn_cc_set_reading", { p_unit: u.id, p_date: day, p_slot: slot, p_value: value, p_by: rt.user?.name ?? null, p_action: null });
    if (error) setErr(error.message);
    else rt.afterWrite();
  }

  return (
    <Card title={T("Temperatures")} actions={<DayPicker day={day} setDay={setDay} />}>
      {err && <p role="alert" className="px-4 pt-3 text-sm text-red-600">{err}</p>}
      {!units.data?.length ? <p className="p-6 text-center text-sm text-ink-gray-5">{T("Add a fridge or store first.")} <a href="#/e/cold-units/new" className="text-brand">{T("New unit")}</a></p> : (
        <table className="w-full text-sm" data-testid="temperatures">
          <thead><tr className="text-xs text-ink-gray-4"><th className="px-4 py-2 text-start font-medium">{T("Unit")}</th><th className="px-4 py-2 text-start font-medium">{T("Safe range")}</th><th className="px-4 py-2 text-start font-medium">{T("Morning")}</th><th className="px-4 py-2 text-start font-medium">{T("Evening")}</th></tr></thead>
          <tbody className="divide-y divide-outline-gray-1">
            {units.data.map((u) => (
              <tr key={String(u.id)} data-unit={String(u.name)}>
                <td className="px-4 py-2"><div className="font-medium">{String(u.name)}</div><div className="text-xs text-ink-gray-5">{tValue(locale, String(u.kind))}</div></td>
                <td className="px-4 py-2 tabular-nums" dir="ltr">{Number(u.min_temp)} – {Number(u.max_temp)} °C</td>
                {["AM", "PM"].map((slot) => {
                  const v = at(String(u.id), slot);
                  const out = v != null && (Number(v) < Number(u.min_temp) || Number(v) > Number(u.max_temp));
                  return (
                    <td key={slot} className="px-4 py-2">
                      <input key={`${day}-${String(v ?? "")}`} data-slot={slot} type="number" step="0.1" dir="ltr" defaultValue={v == null ? "" : String(Number(v))}
                        onBlur={(e) => { if (e.target.value !== (v == null ? "" : String(Number(v)))) void save(u, slot, e.target.value); }}
                        className={`w-24 rounded-md border px-2 py-1 text-sm tabular-nums ${out ? "border-red-400 bg-red-50 text-red-700" : "border-outline-gray-2"}`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

type Step = { text?: string; warning?: string } | string;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === "string" ? (() => { try { return JSON.parse(v) as unknown[]; } catch { return []; } })() : []);

export function Guides({ id }: { id?: string }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [q, setQ] = useState("");
  const all = useLocalQuery<Row[]>((c) => c.from("kb_guides").select("id, title, category, version, next_review").search(["title", "purpose", "summary"], q).order("title").limit(100), [q]);
  const one = useLocalQuery<Row>((c) => (id ? c.from("kb_guides").select("*").eq("id", id).single() : Promise.resolve({ data: null, error: null })), [id]);
  if (id) {
    const g = one.data;
    if (!g) return <p className="text-sm text-ink-gray-5">{T("Loading…")}</p>;
    return (
      <Card title={`${String(g.title)} · v${String(g.version)}`} actions={<a href="#/guides" className="text-sm text-brand">{T("Back")}</a>}>
        <div className="space-y-4 p-4 text-sm leading-relaxed" data-testid="guide">
          {Boolean(g.purpose) && <p><span className="font-semibold">{T("Purpose")}: </span>{String(g.purpose)}</p>}
          {Boolean(g.summary) && <p className="text-ink-gray-6">{String(g.summary)}</p>}
          <ol className="list-decimal space-y-2 ps-5">
            {list(g.steps).map((s, i) => {
              const step = s as Step;
              return <li key={i}>{typeof step === "string" ? step : step.text}{typeof step !== "string" && step.warning && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{step.warning}</div>}</li>;
            })}
          </ol>
          {Boolean(g.safety) && <p className="rounded-lg bg-red-50 p-3 text-red-800"><span className="font-semibold">{T("Safety")}: </span>{String(g.safety)}</p>}
          <p className="text-xs text-ink-gray-5">{T("Guides are written on the installed version; here they are read.")}</p>
        </div>
      </Card>
    );
  }
  return (
    <Card title={T("Guides")} actions={<SearchBox value={q} onChange={setQ} />}>
      {!all.data?.length ? <p className="p-6 text-center text-sm text-ink-gray-5">{T("No guides yet")}</p> : (
        <ul className="divide-y divide-outline-gray-1" data-testid="guides">
          {all.data.map((g) => (
            <li key={String(g.id)}><a href={`#/guides/${String(g.id)}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-gray-1">
              <span className="font-medium text-ink-gray-8">{String(g.title)}</span>
              <span className="text-xs text-ink-gray-5">{tValue(locale, String(g.category))} · v{String(g.version)}</span>
            </a></li>
          ))}
        </ul>
      )}
    </Card>
  );
}
