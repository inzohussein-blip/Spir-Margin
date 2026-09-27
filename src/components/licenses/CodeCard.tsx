"use client";

import { useState } from "react";
import {
  KeyRoundIcon, CopyIcon, PauseIcon, PlayIcon, Trash2Icon, ClockIcon, MonitorIcon, DatabaseIcon, MessageSquareIcon,
  ChevronDownIcon, RotateCcwIcon, BellRingIcon, ReceiptIcon, WifiOffIcon, RefreshCwIcon, PhoneIcon,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import { waLink } from "@/lib/whatsapp";
import {
  stateOf, timeLeft, inactiveDevice, outdatedDevice, reminderMessage, quote, money,
  type PanelRow as Row, type PanelDevice, type CodeState, type Plan,
} from "@/lib/license/panel";
import { SmallBtn, StationChips, DbLink, fmt, fmtTime } from "./parts";

/** One code in the list: its status stripe and time bar, flags, quick actions, and its details. */

export const STATE_LABEL: Record<CodeState, string> = { active: "Active", waiting: "Not activated yet", expiring: "Ending soon", expired: "Expired", stopped: "Stopped" };
export const STATE_TONE: Record<CodeState, string> = {
  active: "bg-emerald-50 text-emerald-700", waiting: "bg-sky-50 text-sky-700", expiring: "bg-amber-50 text-amber-700",
  expired: "bg-red-50 text-red-700", stopped: "bg-surface-gray-2 text-ink-gray-6",
};
const STRIPE: Record<CodeState, string> = {
  active: "border-s-emerald-500", waiting: "border-s-sky-400", expiring: "border-s-amber-500", expired: "border-s-red-500", stopped: "border-s-gray-400",
};
const BAR: Record<CodeState, string> = {
  active: "bg-emerald-500", waiting: "bg-sky-400", expiring: "bg-amber-500", expired: "bg-red-500", stopped: "bg-gray-400",
};

const EVENT_LABEL: Record<string, string> = {
  created: "Created", extended: "Extended", activated: "A computer joined", stopped: "Stopped", resumed: "Resumed",
  seats: "Computers changed", device_reset: "A computer's seat freed", modules: "Stations changed", renamed: "Renamed",
  paid: "Paid", unpaid: "Marked unpaid", message: "Message", new_code: "New code", sync: "Database link",
  phone: "Phone", offline: "Days offline",
};

type Ev = { license_id: string; at: number; kind: string; detail: string };
type Change = (c: Record<string, unknown>, done?: string) => void;

/** A short status the owner sends the company (WhatsApp): period, computers, stations. */
export function statusMessage(r: Row, now: number, T: (k: string) => string): string {
  const st = stateOf(r, now);
  return [
    `${r.company} — ${T(STATE_LABEL[st])}`,
    r.expires_at ? `${T("until")} ${fmt(r.expires_at)}` : `${r.duration_days} ${T("days from the first computer")}`,
    `${T("Computers")}: ${r.devices.length}/${r.seats}`,
    `${T("Stations")}: ${STATIONS.filter((s) => r.modules.includes(s.id)).map((s) => T(s.label)).join("، ")}`,
  ].join("\n");
}

export function CodeCard({ r, rows, evs, now, latest, plan, busy, onChange, onError, onSaved, say }: {
  r: Row; rows: Row[]; evs: Ev[]; now: number; latest: number | null; plan: Plan; busy: boolean;
  onChange: Change; onError: (x: Record<string, unknown>) => void; onSaved: (m: string) => void; say: (ok: boolean, text: string) => void;
}) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [open, setOpen] = useState(false);
  const st = stateOf(r, now);
  const left = timeLeft(r, now);
  const inactive = r.devices.filter((d) => inactiveDevice(d, now)).length;
  const outdated = r.devices.filter((d) => outdatedDevice(d, latest)).length;
  const syncErrors = r.devices.filter((d) => d.sync_error).length;
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => say(true, T("Copied")), () => undefined);
  const reminder = reminderMessage(r, now, T);
  return (
    <div data-code-row={r.company} className={`overflow-hidden rounded-2xl border border-s-4 border-outline-gray-2 bg-surface-white shadow-sm ${STRIPE[st]}`}>
      <div className="flex flex-wrap items-center gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold text-ink-gray-8">{r.company}</span>
            <span dir="ltr" className="font-mono text-xs text-ink-gray-5">…{r.code_hint}</span>
            <span data-state={st} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[st]}`}>{T(STATE_LABEL[st])}</span>
            {r.is_trial && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{T("Trial")}</span>}
            {!r.is_trial && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.paid ? "bg-emerald-50 text-emerald-700" : "bg-surface-gray-2 text-ink-gray-6"}`}>
                {r.paid ? T("Paid") : T("Not paid")}{r.price ? ` · ${r.price}` : ""}
              </span>
            )}
            {inactive > 0 && <span data-flag="inactive" className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700"><WifiOffIcon size={11} /> {inactive} {T("inactive")}</span>}
            {outdated > 0 && <span data-flag="outdated" className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">{T("Old version")}</span>}
            {syncErrors > 0 && <span data-flag="sync-error" className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{T("Sync error")}</span>}
            {r.message && <span title={r.message} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"><MessageSquareIcon size={11} /> {T("Message")}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-gray-5">
            <span className="inline-flex items-center gap-1"><MonitorIcon size={12} /> <span data-seats>{r.devices.length}/{r.seats}</span> {T("computers")}</span>
            <span className="inline-flex items-center gap-1"><ClockIcon size={12} />
              {r.expires_at == null ? `${r.duration_days} ${T("days from the first computer")}` : `${T("until")} ${fmt(r.expires_at)}`}
            </span>
            <span className="inline-flex items-center gap-1"><DatabaseIcon size={12} /> {r.sync ? <span dir="ltr">{r.sync.host}</span> : T("On each computer only")}</span>
            {r.phone && <span className="inline-flex items-center gap-1"><PhoneIcon size={12} /> <span dir="ltr">{r.phone}</span></span>}
            {r.max_offline_days > 0 && <span className="inline-flex items-center gap-1"><WifiOffIcon size={12} /> {r.max_offline_days} {T("days offline at most")}</span>}
          </div>
          {/* The time left: how much of the period remains, in the state's colour. */}
          <div className="mt-2.5 flex items-center gap-2" data-timebar data-left={left?.days ?? ""}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-gray-2" role="meter" aria-label={T("Time left")}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((left?.fraction ?? 1) * 100)}>
              <div className={`h-full rounded-full ${BAR[st]}`} style={{ width: `${left ? Math.max(left.fraction > 0 ? 2 : 0, left.fraction * 100) : 100}%`, opacity: left ? 1 : 0.35 }} />
            </div>
            <span className="w-24 shrink-0 text-end text-xs tabular-nums text-ink-gray-6">
              {left == null ? T("Not started") : left.days > 0 ? `${left.days} ${T("days left")}` : T("Ended")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select aria-label={T("Extend")} disabled={busy} value="" onChange={(e) => { const d = Number(e.target.value); if (d) onChange({ action: "extend", days: d }, "Extended"); }}
            className="rounded-lg border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-xs">
            <option value="">{T("Extend…")}</option>
            {[30, 90, 180, 365].map((d) => <option key={d} value={d}>+{d} {T("days")}</option>)}
          </select>
          {r.status === "active"
            ? <SmallBtn onClick={() => onChange({ action: "stop" }, "Stopped")} icon={<PauseIcon size={13} />} label={T("Stop")} />
            : <SmallBtn onClick={() => onChange({ action: "resume" }, "Resumed")} icon={<PlayIcon size={13} />} label={T("Resume")} />}
          {(st === "expiring" || st === "expired") && (
            <span data-reminder className="inline-flex items-center gap-1">
              <SmallBtn onClick={() => copy(reminder)} icon={<BellRingIcon size={13} />} label={T("Reminder")} />
              {r.phone && <a href={waLink(r.phone, reminder)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-200 px-2 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50">{T("WhatsApp")}</a>}
            </span>
          )}
          <SmallBtn onClick={() => copy(statusMessage(r, now, T))} icon={<CopyIcon size={13} />} label={T("Status message")} />
          <button onClick={() => setOpen(!open)} aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-lg border border-outline-gray-2 px-2 py-1.5 text-xs hover:bg-surface-gray-1">
            {T("Details")} <ChevronDownIcon size={13} className={open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>
      {open && <Details r={r} rows={rows} evs={evs} now={now} latest={latest} plan={plan} busy={busy} onChange={onChange} onError={onError} onSaved={onSaved} />}
    </div>
  );
}

const SYNC_KIND: Record<string, string> = { hosted: "Hosted database", lan: "Main computer", none: "No sync" };

function DeviceLine({ d, now, latest, onChange }: { d: PanelDevice; now: number; latest: number | null; onChange: Change }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const inactive = inactiveDevice(d, now);
  const old = outdatedDevice(d, latest);
  return (
    <li data-device={d.device_id} className="space-y-1.5 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <MonitorIcon size={14} className="text-ink-gray-5" />
        <input defaultValue={d.name} placeholder={d.label || T("Name this computer")} aria-label={T("Name this computer")}
          onBlur={(e) => { if (e.target.value !== d.name) onChange({ action: "device_name", device: d.device_id, name: e.target.value }); }}
          className="min-w-[10rem] flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-outline-gray-2 focus:border-brand" />
        <span className="text-xs text-ink-gray-5">{d.label}</span>
        {inactive && <span data-flag="inactive" className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700">{T("Inactive computer")}</span>}
        {d.app_version && <span dir="ltr" className={`rounded px-1.5 text-[11px] ${old ? "bg-yellow-50 text-yellow-800" : "bg-surface-gray-2"}`} title={old ? T("Old version") : ""}>{d.app_version}</span>}
        <SmallBtn onClick={() => { if (confirm(T("Free this computer's seat? It will need the code again."))) onChange({ action: "reset_device", device: d.device_id }, "The seat is free"); }}
          icon={<RotateCcwIcon size={12} />} label={T("Free the seat")} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-gray-5">
        <span>{T("Joined")} {fmt(d.activated_at)}</span>
        <span>{T("Last seen")} <span dir="ltr" className="tabular-nums">{fmtTime(d.last_seen_at)}</span></span>
        {/* What the computer said about its own sync at its last check. */}
        <span data-sync className="inline-flex items-center gap-1">
          <RefreshCwIcon size={11} />
          {d.sync_kind ? T(SYNC_KIND[d.sync_kind] ?? "No sync") : T("Not reported yet")}
          {d.sync_kind && d.sync_kind !== "none" && (
            <>
              {" · "}{T("Last sync")} <span dir="ltr" className="tabular-nums">{fmtTime(d.sync_at)}</span>
              {" · "}<span data-pending={d.sync_pending ?? 0}>{d.sync_pending ?? 0} {T("waiting")}</span>
            </>
          )}
        </span>
        {d.sync_error && <span className="text-red-600" dir="auto" title={d.sync_error}>{T("Last error")}: {d.sync_error.slice(0, 80)}</span>}
      </div>
    </li>
  );
}

function Details({ r, rows, evs, now, latest, plan, busy, onChange, onError, onSaved }: {
  r: Row; rows: Row[]; evs: Ev[]; now: number; latest: number | null; plan: Plan; busy: boolean;
  onChange: Change; onError: (x: Record<string, unknown>) => void; onSaved: (m: string) => void;
}) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [company, setCompany] = useState(r.company);
  const [noteText, setNoteText] = useState(r.note);
  const [seats, setSeats] = useState(r.seats);
  const [offline, setOffline] = useState(r.max_offline_days);
  const [phone, setPhone] = useState(r.phone);
  const [mods, setMods] = useState(r.modules);
  const [price, setPrice] = useState(r.price);
  const [msg, setMsg] = useState(r.message);
  const [db, setDb] = useState(false);
  const planPrice = quote(plan, r.modules, r.duration_days, r.seats);
  const cls = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm outline-none focus:border-brand";
  const btn = "rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-xs hover:bg-surface-gray-1 disabled:opacity-50";
  return (
    <div className="space-y-4 border-t border-outline-gray-2 bg-surface-gray-1/50 p-4 text-sm">
      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Computers using this code")}</div>
        {r.devices.length === 0 ? <p className="text-xs text-ink-gray-5">{T("None yet — the first computer that enters the code starts its period.")}</p> : (
          <ul className="space-y-1.5">{r.devices.map((d) => <DeviceLine key={d.device_id} d={d} now={now} latest={latest} onChange={onChange} />)}</ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2"><span className="text-xs text-ink-gray-5">{T("Company")}</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={cls} /></label>
        <label className="block"><span className="text-xs text-ink-gray-5">{T("Computers")}</span>
          <input type="number" min={1} max={100} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={cls} /></label>
        <label className="block"><span className="text-xs text-ink-gray-5">{T("Days offline at most (0: no limit)")}</span>
          <input type="number" min={0} max={365} name="offline" value={offline} onChange={(e) => setOffline(Number(e.target.value))} className={cls} /></label>
        <label className="block sm:col-span-2"><span className="text-xs text-ink-gray-5">{T("Company phone (WhatsApp)")}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" name="phone" placeholder="07XX XXX XXXX" className={cls} /></label>
        <label className="block sm:col-span-2"><span className="text-xs text-ink-gray-5">{T("Note (only you see it)")}</span>
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} className={cls} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onChange({ action: "rename", company, note: noteText }, "Saved successfully")} className={btn}>{T("Save the name")}</button>
        <button disabled={busy || seats === r.seats} onClick={() => onChange({ action: "seats", seats }, "Saved successfully")} className={btn}>{T("Save the computers")}</button>
        <button disabled={busy || offline === r.max_offline_days} onClick={() => onChange({ action: "offline", days: offline }, "Saved successfully")} className={btn}>{T("Save the offline days")}</button>
        <button disabled={busy || phone === r.phone} onClick={() => onChange({ action: "phone", phone }, "Saved successfully")} className={btn}>{T("Save the phone")}</button>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Stations")}</div>
        <StationChips value={mods} onChange={setMods} />
        <button disabled={busy} onClick={() => onChange({ action: "modules", modules: mods }, "Saved successfully")} className={`mt-2 ${btn}`}>{T("Save the stations")}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Payment")}</div>
          <div className="flex items-center gap-2">
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={T("Amount")} className={cls} />
            <button onClick={() => onChange({ action: "payment", price, paid: !r.paid }, "Saved successfully")} className={`shrink-0 ${btn}`}>
              {r.paid ? T("Mark unpaid") : T("Mark paid")}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
            {planPrice.total > 0 && (
              <button type="button" onClick={() => setPrice(`${money(planPrice.total)} ${plan.currency}`)} className="text-brand underline">
                {T("By your prices")}: {money(planPrice.total)} {plan.currency}
              </button>
            )}
            {r.paid && (
              <a href={`/licenses/receipt/${r.id}`} target="_blank" rel="noopener" data-receipt className="inline-flex items-center gap-1 text-brand underline">
                <ReceiptIcon size={12} /> {T("Payment receipt")}
              </a>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Message to the company's computers")}</div>
          <div className="flex items-center gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={T("Shown at their next check")} className={cls} />
            <button onClick={() => onChange({ action: "message", text: msg }, "Saved successfully")} className={`shrink-0 ${btn}`}>{T("Send")}</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SmallBtn onClick={() => setDb(!db)} icon={<DatabaseIcon size={13} />} label={T("The company's database")} />
        <SmallBtn onClick={() => { if (confirm(T("Make a new code? The old one stops working; computers already running keep going."))) onChange({ action: "new_code" }); }} icon={<KeyRoundIcon size={13} />} label={T("New code")} />
        <SmallBtn danger onClick={() => { if (confirm(T("Delete this code and its history? Its computers lock at their next check."))) onChange({ action: "delete" }, "Deleted successfully"); }} icon={<Trash2Icon size={13} />} label={T("Delete")} />
      </div>
      {db && <DbLink r={r} rows={rows} onError={onError} onSaved={onSaved} />}

      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("History")}</div>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
          {evs.map((e, i) => (
            <li key={i} className="flex gap-2"><span dir="ltr" className="shrink-0 tabular-nums text-ink-gray-5">{fmtTime(e.at)}</span>
              <span className="font-medium text-ink-gray-7">{T(EVENT_LABEL[e.kind] ?? e.kind)}</span>
              {e.detail && <span className="truncate text-ink-gray-5" dir="auto">{e.detail}</span>}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
