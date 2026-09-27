"use client";

import { useState } from "react";
import { KeyRoundIcon, PlusIcon, SparklesIcon, ReceiptIcon, TagIcon, CalculatorIcon, ShieldCheckIcon, HistoryIcon, CopyIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS, DEFAULT_STATIONS } from "@/lib/license/modules";
import { waLink } from "@/lib/whatsapp";
import { quote, finance, money, reminderMessage, activationMessage, type PanelRow as Row, type Plan } from "@/lib/license/panel";
import { BarList, AsTable } from "@/components/charts/Bars";
import { Card, Stat, StationChips, CopyButton, api, fmt, fmtTime } from "./parts";

/** The code manager's sections besides the list of codes. */

const PRESETS: [number, string][] = [[30, "A month"], [90, "3 months"], [180, "6 months"], [365, "A year"]];
const input = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand";

export type Fresh = { company: string; code: string; days: number; seats: number; modules: string[]; phone: string };

// ── New code ─────────────────────────────────────────────────────────────────
export function CreateForm({ plan, onCreated, onError }: { plan: Plan; onCreated: (f: Fresh) => void; onError: (r: Record<string, unknown>) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState(365);
  const [seats, setSeats] = useState(1);
  const [offline, setOffline] = useState(30);
  const [mods, setMods] = useState<string[]>([...DEFAULT_STATIONS]);
  const [note, setNote] = useState("");
  const [trial, setTrial] = useState(false);
  const [price, setPrice] = useState<string | null>(null); // null: follows the prices
  const [busy, setBusy] = useState(false);
  const q = quote(plan, mods, days, seats);
  const shownPrice = price ?? (q.total > 0 && !trial ? `${money(q.total)} ${plan.currency}` : "");

  async function make(v: { company: string; days: number; seats: number; modules: string[]; trial: boolean; price: string }) {
    setBusy(true);
    const r = await api({ op: "create", ...v, note, phone, maxOfflineDays: offline });
    setBusy(false);
    if (!r.ok) return onError(r);
    onCreated({ company: v.company, code: String(r.code), days: v.days, seats: v.seats, modules: v.modules, phone });
    setCompany(""); setNote(""); setTrial(false); setPhone(""); setPrice(null);
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); make({ company, days, seats, modules: mods, trial, price: trial ? "" : shownPrice }); }}
      className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm" data-testid="create-code">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-gray-8"><PlusIcon size={18} className="text-brand" /> {T("New code")}</h2>
        {/* One click: a trial code for every station, one computer, the trial days of the prices. */}
        <button type="button" disabled={busy} data-testid="trial-code"
          onClick={() => make({ company: company.trim() || `${T("Trial")} ${new Date().toLocaleDateString("en-CA")}`, days: plan.trialDays, seats: 1, modules: STATIONS.map((s) => s.id), trial: true, price: "" })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60">
          <SparklesIcon size={14} /> {T("Trial code")} ({plan.trialDays} {T("days")})
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink-gray-5">{T("Company")}</span>
          <input name="company" value={company} onChange={(e) => setCompany(e.target.value)} required className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink-gray-5">{T("Company phone (WhatsApp)")}</span>
          <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" className={input} />
        </label>
        <div className="sm:col-span-2">
          <span className="text-xs text-ink-gray-5">{T("Period")}</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5" data-testid="presets">
            {PRESETS.map(([d, label]) => (
              <button type="button" key={d} data-days={d} aria-pressed={days === d} onClick={() => setDays(d)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${days === d ? "border-brand bg-brand-light text-brand-dark" : "border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-1"}`}>
                {T(label)}
              </button>
            ))}
            <input name="days" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={T("Days")}
              className="w-20 rounded-lg border border-outline-gray-2 px-2 py-1.5 text-sm outline-none focus:border-brand" />
            <span className="text-xs text-ink-gray-5">{T("days")}</span>
          </div>
        </div>
        <label className="block">
          <span className="text-xs text-ink-gray-5">{T("Computers")}</span>
          <input name="seats" type="number" min={1} max={100} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={input} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-gray-5">{T("Days offline at most (0: no limit)")}</span>
          <input name="offline" type="number" min={0} max={365} value={offline} onChange={(e) => setOffline(Number(e.target.value))} className={input} />
        </label>
      </div>
      <div className="mt-3">
        <span className="text-xs text-ink-gray-5">{T("Stations")}</span>
        <div className="mt-1"><StationChips value={mods} onChange={setMods} /></div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs text-ink-gray-5">{T("Price")}{q.total > 0 ? ` — ${T("by your prices")}: ${money(q.monthly)} × ${q.months}` : ""}</span>
          <input name="price" value={trial ? "" : shownPrice} disabled={trial} onChange={(e) => setPrice(e.target.value)} className={input} data-testid="create-price" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-gray-5">{T("Note (only you see it)")}</span>
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className={input} />
        </label>
        <label className="inline-flex items-center gap-2 pb-2 text-sm text-ink-gray-7">
          <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} /> {T("Trial")}
        </label>
      </div>
      <button disabled={busy || !company.trim()} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        <KeyRoundIcon size={15} /> {T("Make the code")}
      </button>
    </form>
  );
}

/** The new code, shown once: copy it, or the whole activation message, or send it on WhatsApp. */
export function FreshCode({ f, contact, onClose }: { f: Fresh; contact: string; onClose: () => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [copied, setCopied] = useState(false);
  const msg = activationMessage({
    company: f.company, code: f.code, days: f.days, seats: f.seats, contact,
    stations: STATIONS.filter((s) => f.modules.includes(s.id)).map((s) => T(s.label)),
  }, T);
  return (
    <div data-testid="new-code" className="rounded-2xl border-2 border-brand/40 bg-brand-light p-4">
      <div className="text-sm font-semibold text-ink-gray-8">{T("The code for")} «{f.company}»</div>
      <p className="mt-1 text-xs text-ink-gray-6">{T("Copy it now: it is shown only this once. It is kept only as a fingerprint.")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code dir="ltr" data-code className="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 font-mono text-lg tracking-widest">{f.code}</code>
        <CopyButton text={f.code} label={T("Copy")} />
        <button type="button" data-testid="copy-activation" onClick={() => navigator.clipboard?.writeText(msg).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => undefined)}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm hover:bg-surface-gray-1">
          <CopyIcon size={14} /> {copied ? T("Copied") : T("Copy the activation message")}
        </button>
        <a href={waLink(f.phone, msg)} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-activation"
          className="rounded-lg border border-emerald-200 bg-surface-white px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">{T("WhatsApp")}</a>
        <button onClick={onClose} className="text-xs text-ink-gray-5 underline">{T("Close")}</button>
      </div>
      <pre data-testid="activation-message" className="mt-3 whitespace-pre-wrap rounded-lg border border-outline-gray-2 bg-surface-white p-3 text-xs leading-relaxed text-ink-gray-7" dir="auto">{msg}</pre>
    </div>
  );
}

// ── Money ────────────────────────────────────────────────────────────────────
export function MoneySection({ rows, now, plan, onPaid }: { rows: Row[]; now: number; plan: Plan; onPaid: (id: string, price: string) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const f = finance(rows);
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const monthData = f.months.slice(0, 12).map((m) => ({ label: m.month, value: m.total, hint: `${m.count} ${T("codes")}` }));
  const unpaid = rows.filter((r) => !r.paid && !r.is_trial);
  const paid = rows.filter((r) => r.paid).sort((a, b) => (b.paid_at ?? 0) - (a.paid_at ?? 0));
  const fmtMoney = (n: number) => `${money(n)} ${plan.currency}`;
  return (
    <div className="space-y-4" data-testid="money">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={T("Received")} value={fmtMoney(f.paid)} />
        <Stat label={T("This month")} value={fmtMoney(f.months.find((m) => m.month === thisMonth)?.total ?? 0)} />
        <Stat label={`${T("Not paid")} (${f.unpaidCount})`} value={fmtMoney(f.unpaid)} tone={f.unpaid ? "text-amber-700" : undefined} />
      </div>
      <Card icon={<ReceiptIcon size={18} />} title={T("Received by month")}>
        <div data-testid="money-months"><BarList data={monthData} format={fmtMoney} empty={T("Nothing received yet")} /></div>
        <AsTable data={monthData} format={fmtMoney} label={T("Show as a table")} head={[T("Month"), T("Received")]} />
      </Card>
      <Card icon={<TagIcon size={18} />} title={T("Not paid yet")}>
        {unpaid.length === 0 ? <p className="text-sm text-ink-gray-5">{T("Every code is paid.")}</p> : (
          <ul className="divide-y divide-outline-gray-1 text-sm" data-testid="unpaid">
            {unpaid.map((r) => {
              const suggested = r.price || (() => { const q = quote(plan, r.modules, r.duration_days, r.seats); return q.total ? fmtMoney(q.total) : ""; })();
              return (
                <li key={r.id} data-unpaid={r.company} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-gray-8">{r.company}</span>
                  <span className="tabular-nums text-ink-gray-6">{suggested || "—"}</span>
                  {r.phone && <a href={waLink(r.phone, reminderMessage(r, now, T))} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">{T("WhatsApp")}</a>}
                  <button onClick={() => onPaid(r.id, suggested)} className="rounded-lg border border-outline-gray-2 px-2 py-1 text-xs hover:bg-surface-gray-1">{T("Mark paid")}</button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card icon={<ReceiptIcon size={18} />} title={T("Payment receipts")}>
        {paid.length === 0 ? <p className="text-sm text-ink-gray-5">{T("Nothing received yet")}</p> : (
          <ul className="divide-y divide-outline-gray-1 text-sm">
            {paid.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate">{r.company}</span>
                <span className="tabular-nums text-ink-gray-6">{r.price || "—"}</span>
                <span dir="ltr" className="tabular-nums text-xs text-ink-gray-5">{fmt(r.paid_at)}</span>
                <a href={`/licenses/receipt/${r.id}`} target="_blank" rel="noopener" data-receipt className="text-xs text-brand underline">{T("Payment receipt")}</a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Prices ───────────────────────────────────────────────────────────────────
export function PricesSection({ plan, onSaved, onError }: { plan: Plan; onSaved: () => void; onError: (r: Record<string, unknown>) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [p, setP] = useState<Plan>(plan);
  const [mods, setMods] = useState<string[]>([...DEFAULT_STATIONS]);
  const [days, setDays] = useState(365);
  const [seats, setSeats] = useState(1);
  const q = quote(p, mods, days, seats);
  const num = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card icon={<TagIcon size={18} />} title={T("Your prices")}>
        <p className="mb-3 text-xs text-ink-gray-6">{T("A month of each station, and of each computer after the first. A code's price is worked out from these.")}</p>
        <div className="grid grid-cols-2 gap-2" data-testid="plan">
          {STATIONS.map((s) => (
            <label key={s.id} className="block">
              <span className="text-xs text-ink-gray-5">{T(s.label)}</span>
              <input type="number" min={0} data-plan-station={s.id} value={p.stations[s.id] ?? 0}
                onChange={(e) => setP({ ...p, stations: { ...p.stations, [s.id]: Number(e.target.value) } })} className={num} />
            </label>
          ))}
          <label className="block">
            <span className="text-xs text-ink-gray-5">{T("Each extra computer")}</span>
            <input type="number" min={0} data-plan-seat value={p.seat} onChange={(e) => setP({ ...p, seat: Number(e.target.value) })} className={num} />
          </label>
          <label className="block">
            <span className="text-xs text-ink-gray-5">{T("Currency")}</span>
            <input value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })} className={num} />
          </label>
          <label className="block">
            <span className="text-xs text-ink-gray-5">{T("Trial days")}</span>
            <input type="number" min={1} max={60} value={p.trialDays} onChange={(e) => setP({ ...p, trialDays: Number(e.target.value) })} className={num} />
          </label>
        </div>
        <button data-testid="save-plan" onClick={async () => { const r = await api({ op: "plan", plan: p }); if (!r.ok) return onError(r); onSaved(); }}
          className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">{T("Save")}</button>
      </Card>
      <Card icon={<CalculatorIcon size={18} />} title={T("Price of a code")}>
        <StationChips value={mods} onChange={setMods} />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {PRESETS.map(([d, label]) => (
            <button type="button" key={d} aria-pressed={days === d} onClick={() => setDays(d)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${days === d ? "border-brand bg-brand-light text-brand-dark" : "border-outline-gray-2 text-ink-gray-6"}`}>{T(label)}</button>
          ))}
          <label className="ms-2 inline-flex items-center gap-1 text-xs text-ink-gray-6">{T("Computers")}
            <input type="number" min={1} max={100} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className="w-16 rounded-lg border border-outline-gray-2 px-2 py-1 text-sm" />
          </label>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-ink-gray-5">{T("A month")}</dt><dd className="text-end tabular-nums">{money(q.monthly)} {p.currency}</dd>
          <dt className="text-ink-gray-5">{T("Months")}</dt><dd className="text-end tabular-nums">{q.months}</dd>
          <dt className="font-semibold text-ink-gray-8">{T("Total")}</dt>
          <dd className="text-end text-lg font-bold tabular-nums text-ink-gray-9" data-testid="quote-total">{money(q.total)} {p.currency}</dd>
        </dl>
      </Card>
    </div>
  );
}

// ── Security: sign-ins and what the owner did ───────────────────────────────
export type OwnerAction = { at: number; ip: string; agent: string; license_id: string; company: string; action: string; detail: string };
const ACTION_LABEL: Record<string, string> = {
  create: "Made a code", create_trial: "Made a trial code", extend: "Extended", stop: "Stopped", resume: "Resumed",
  seats: "Computers changed", reset_device: "A computer's seat freed", device_name: "Named a computer", modules: "Stations changed",
  rename: "Renamed", payment: "Payment", message: "Message", new_code: "New code", delete: "Deleted", phone: "Phone",
  offline: "Days offline", backup: "Downloaded a backup", restore: "Restored a backup", plan: "Prices changed",
  totp_on: "Two-step sign-in on", totp_off: "Two-step sign-in off", contact: "Contact line", sync: "Database link", unsync: "Unlinked",
};

export function SignInsCard({ signIns }: { signIns: { at: number; ok: boolean; ip: string; agent: string }[] }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  return (
    <Card icon={<ShieldCheckIcon size={18} />} title={T("Sign-ins to this page")}>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-xs" data-testid="sign-ins">
        {signIns.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className={s.ok ? "text-emerald-700" : "text-red-600"}>{s.ok ? T("Signed in") : T("Refused")}</span>
            <span dir="ltr" className="font-mono text-ink-gray-5">{s.ip}</span>
            <span dir="ltr" className="tabular-nums text-ink-gray-5">{fmtTime(s.at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ActionsCard({ actions }: { actions: OwnerAction[] }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  return (
    <Card icon={<HistoryIcon size={18} />} title={T("What was done on this page")}>
      {actions.length === 0 ? <p className="text-sm text-ink-gray-5">{T("Nothing yet")}</p> : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs" data-testid="owner-actions">
            <thead className="text-ink-gray-5"><tr><th className="py-1 text-start font-medium">{T("When")}</th><th className="py-1 text-start font-medium">{T("What")}</th><th className="py-1 text-start font-medium">{T("Company")}</th><th className="py-1 text-start font-medium">{T("Address")}</th></tr></thead>
            <tbody className="divide-y divide-outline-gray-1">
              {actions.map((a, i) => (
                <tr key={i} data-action={a.action}>
                  <td dir="ltr" className="py-1 text-start tabular-nums text-ink-gray-5">{fmtTime(a.at)}</td>
                  <td className="py-1"><span className="font-medium text-ink-gray-7">{T(ACTION_LABEL[a.action] ?? a.action)}</span>{a.detail && <span className="ms-1 text-ink-gray-5" dir="auto">{a.detail}</span>}</td>
                  <td className="py-1 text-ink-gray-7">{a.company || "—"}</td>
                  <td dir="ltr" className="py-1 text-start font-mono text-ink-gray-5" title={a.agent}>{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
