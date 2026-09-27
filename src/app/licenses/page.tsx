"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyRoundIcon, LogOutIcon, RefreshCwIcon, PlusIcon, CopyIcon, CheckIcon, PauseIcon, PlayIcon, Trash2Icon,
  ClockIcon, MonitorIcon, DatabaseIcon, ShieldCheckIcon, PhoneIcon, SmartphoneIcon, DownloadIcon, UploadIcon,
  MessageSquareIcon, LockIcon, ChevronDownIcon, RotateCcwIcon, HardDriveIcon, FileSpreadsheetIcon,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS, DEFAULT_STATIONS } from "@/lib/license/modules";
import { arabicIncludes } from "@/lib/text/arabic";

/**
 * The code manager («إدارة الرموز») — the owner's page on the codes server
 * (the web version). One code per subscribing company: how many computers,
 * how long, which stations; extend, stop, move a computer's seat, see which
 * computers use it and which version they run, link the company's database,
 * keep a backup. Signed in with LICENSE_ADMIN_PASSWORD (and an authenticator
 * code once set up); not tied to the app's accounts.
 */

type Device = { device_id: string; label: string; name: string; activated_at: number; last_seen_at: number | null; app_version: string };
type Row = {
  id: string; company: string; note: string; code_hint: string; duration_days: number; seats: number; modules: string[];
  status: "active" | "stopped"; activated_at: number | null; expires_at: number | null; created_at: number;
  price: string; paid: boolean; paid_at: number | null; message: string; is_trial: boolean;
  sync: { host: string; by: "owner" | "device"; at: number } | null; devices: Device[];
};
type Ev = { license_id: string; at: number; kind: string; detail: string };
type TwoFactor = { enabled: boolean; broken: boolean; forcedOff: boolean; canSetup: boolean };
type Data = {
  enabled: boolean; owner: boolean; needsDb?: boolean;
  storage?: { source: string; ok: boolean; codes?: number; error?: string; sealed: boolean; roundTripMs?: number };
  licenses?: Row[]; events?: Ev[]; signIns?: { at: number; ok: boolean; ip: string; agent: string }[];
  twoFactor?: TwoFactor; contact?: string; version?: number | null; now?: number;
};

const DAY = 86_400_000;
const WARN_DAYS = 14;
const fmt = (ms?: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");
const fmtTime = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("en-CA", { hour12: false }).replace(",", "") : "—");

async function api(body: Record<string, unknown>) {
  const r = await fetch("/api/license/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: "error" }))) as Record<string, unknown>;
}

const ERRORS: Record<string, string> = {
  wrong: "Wrong password.",
  need_code: "Enter the code from your authenticator app.",
  wrong_code: "That code is not right, or it was already used.",
  too_many: "Too many attempts — wait a few minutes.",
  auth: "Your session has ended — sign in again.",
  bad_request: "Fill in the company, the days and the number of computers.",
  bad_config: "That does not look like a Postgres connection string",
  pooler: "This address goes through the transaction pooler (port 6543), which this program cannot use. In Supabase choose the Session pooler (port 5432) or the Direct connection.",
  connect: "Could not connect. Check the address and the password, and that this computer is online.",
  no_secret: "Set AUTH_SECRET on the server first.",
  invalid: "That file is not a backup of the codes.",
};

type State = "active" | "waiting" | "expiring" | "expired" | "stopped";
function stateOf(r: Row, now: number): State {
  if (r.status === "stopped") return "stopped";
  if (r.expires_at == null) return "waiting";
  if (r.expires_at <= now) return "expired";
  if (r.expires_at - now <= WARN_DAYS * DAY) return "expiring";
  return "active";
}
const STATE_LABEL: Record<State, string> = { active: "Active", waiting: "Not activated yet", expiring: "Ending soon", expired: "Expired", stopped: "Stopped" };
const STATE_TONE: Record<State, string> = {
  active: "bg-emerald-50 text-emerald-700", waiting: "bg-sky-50 text-sky-700", expiring: "bg-amber-50 text-amber-700",
  expired: "bg-red-50 text-red-700", stopped: "bg-surface-gray-2 text-ink-gray-6",
};

export default function LicensesPage() {
  const locale = useLocale();
  const T = useCallback((k: string) => t(locale, k), [locale]);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [fresh, setFresh] = useState<{ company: string; code: string } | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | State | "unpaid">("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/license/admin", { cache: "no-store" });
    setData((await r.json().catch(() => null)) as Data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const say = (ok: boolean, text: string) => setNote({ ok, text });
  const fail = (r: Record<string, unknown>) => say(false, T(ERRORS[String(r.error)] ?? "Could not save"));

  async function act(id: string, change: Record<string, unknown>, done?: string) {
    setBusy(true);
    const r = await api({ op: "update", id, change });
    setBusy(false);
    if (!r.ok) return fail(r);
    if (typeof r.code === "string") setFresh({ company: (r.row as Row)?.company ?? "", code: r.code });
    if (done) say(true, T(done));
    await load();
  }

  const now = data?.now ?? Date.now();
  const rows = useMemo(() => {
    const list = data?.licenses ?? [];
    return list.filter((r) => {
      if (q && !arabicIncludes(`${r.company} ${r.note} ${r.code_hint} ${r.devices.map((d) => `${d.name} ${d.label}`).join(" ")}`, q)) return false;
      if (filter === "all") return true;
      if (filter === "unpaid") return !r.paid;
      return stateOf(r, now) === filter;
    });
  }, [data, q, filter, now]);

  if (!data) return <Shell><p className="text-sm text-ink-gray-5">{T("Loading…")}</p></Shell>;

  if (!data.enabled) {
    return (
      <Shell>
        <Card icon={<LockIcon size={18} />} title={T("The code manager is off on this server")}>
          <p className="text-sm leading-relaxed text-ink-gray-6">
            {T(data.needsDb
              ? "The owner's password is set, but the codes have no lasting database here. On Vercel add Storage → Neon with the prefix LICENSE, then deploy again."
              : "It runs on the web version. On Vercel set LICENSE_ADMIN_PASSWORD (the owner's password) and AUTH_SECRET, add Storage → Neon with the prefix LICENSE, then deploy again.")}
          </p>
        </Card>
      </Shell>
    );
  }

  if (!data.owner) return <Shell><SignIn onDone={load} /></Shell>;

  const list = data.licenses ?? [];
  const evs = data.events ?? [];
  const counts = {
    all: list.length,
    active: list.filter((r) => stateOf(r, now) === "active").length,
    expiring: list.filter((r) => stateOf(r, now) === "expiring").length,
    devices: list.reduce((s, r) => s + r.devices.length, 0),
  };

  return (
    <Shell
      actions={
        <>
          <button onClick={load} title={T("Refresh")} aria-label={T("Refresh")} className="grid size-9 place-items-center rounded-lg border border-outline-gray-2 bg-surface-white hover:bg-surface-gray-1">
            <RefreshCwIcon size={15} />
          </button>
          <button onClick={async () => { await api({ op: "logout" }); await load(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm hover:bg-surface-gray-1">
            <LogOutIcon size={15} /> {T("Sign out")}
          </button>
        </>
      }
    >
      {note && (
        <div role="status" className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${note.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          <span>{note.text}</span>
          <button onClick={() => setNote(null)} className="text-xs underline">{T("Close")}</button>
        </div>
      )}

      {data.storage && !data.storage.ok && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {T("The codes database does not answer.")} <span dir="ltr" className="font-mono text-xs">{data.storage.error}</span>
        </div>
      )}
      {data.storage && !data.storage.sealed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {T("AUTH_SECRET is not set: the signing key and the companies' database links are sealed with a local key only. Set AUTH_SECRET on the server.")}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={T("Codes")} value={counts.all} />
        <Stat label={T("Active")} value={counts.active} />
        <Stat label={T("Ending soon")} value={counts.expiring} tone={counts.expiring ? "text-amber-700" : undefined} />
        <Stat label={T("Computers")} value={counts.devices} />
      </div>

      <CreateForm onCreated={async (company, code) => { setFresh({ company, code }); await load(); }} onError={fail} />

      {fresh && (
        <div data-testid="new-code" className="rounded-2xl border-2 border-brand/40 bg-brand-light p-4">
          <div className="text-sm font-semibold text-ink-gray-8">{T("The code for")} «{fresh.company}»</div>
          <p className="mt-1 text-xs text-ink-gray-6">{T("Copy it now: it is shown only this once. It is kept only as a fingerprint.")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code dir="ltr" data-code className="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 font-mono text-lg tracking-widest">{fresh.code}</code>
            <CopyButton text={fresh.code} label={T("Copy")} />
            <button onClick={() => setFresh(null)} className="text-xs text-ink-gray-5 underline">{T("Close")}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search a company, a computer or the last 4 of a code…")}
          className="min-w-[14rem] flex-1 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm">
          <option value="all">{T("All")}</option>
          {(["active", "waiting", "expiring", "expired", "stopped"] as State[]).map((s) => <option key={s} value={s}>{T(STATE_LABEL[s])}</option>)}
          <option value="unpaid">{T("Not paid")}</option>
        </select>
        <button onClick={() => downloadCsv(list, now, T)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm hover:bg-surface-gray-1">
          <FileSpreadsheetIcon size={15} /> {T("Export CSV")}
        </button>
      </div>

      <div className="space-y-3" data-testid="codes">
        {rows.length === 0 && <p className="rounded-lg border border-dashed border-outline-gray-2 p-6 text-center text-sm text-ink-gray-5">{T("No codes yet")}</p>}
        {rows.map((r) => {
          const st = stateOf(r, now);
          const left = r.expires_at ? Math.ceil((r.expires_at - now) / DAY) : null;
          return (
            <div key={r.id} data-code-row={r.company} className="rounded-2xl border border-outline-gray-2 bg-surface-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-bold text-ink-gray-8">{r.company}</span>
                    <span dir="ltr" className="font-mono text-xs text-ink-gray-5">…{r.code_hint}</span>
                    <span data-state={st} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[st]}`}>{T(STATE_LABEL[st])}</span>
                    {r.is_trial && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{T("Trial")}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.paid ? "bg-emerald-50 text-emerald-700" : "bg-surface-gray-2 text-ink-gray-6"}`}>
                      {r.paid ? T("Paid") : T("Not paid")}{r.price ? ` · ${r.price}` : ""}
                    </span>
                    {r.message && <span title={r.message} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"><MessageSquareIcon size={11} /> {T("Message")}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-gray-5">
                    <span className="inline-flex items-center gap-1"><MonitorIcon size={12} /> <span data-seats>{r.devices.length}/{r.seats}</span> {T("computers")}</span>
                    <span className="inline-flex items-center gap-1"><ClockIcon size={12} />
                      {r.expires_at == null ? `${r.duration_days} ${T("days from the first computer")}` : `${T("until")} ${fmt(r.expires_at)}${left != null && left > 0 ? ` (${left} ${T("days")})` : ""}`}
                    </span>
                    <span className="inline-flex items-center gap-1"><DatabaseIcon size={12} /> {r.sync ? <span dir="ltr">{r.sync.host}</span> : T("On each computer only")}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {STATIONS.map((s) => (
                      <span key={s.id} className={`rounded-md px-1.5 py-0.5 text-[11px] ${r.modules.includes(s.id) ? s.tone.soft : "bg-surface-gray-1 text-ink-gray-4 line-through"}`}>{T(s.label)}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select aria-label={T("Extend")} disabled={busy} value="" onChange={(e) => { const d = Number(e.target.value); if (d) act(r.id, { action: "extend", days: d }, "Extended"); }}
                    className="rounded-lg border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-xs">
                    <option value="">{T("Extend…")}</option>
                    {[30, 90, 180, 365].map((d) => <option key={d} value={d}>+{d} {T("days")}</option>)}
                  </select>
                  {r.status === "active"
                    ? <SmallBtn onClick={() => act(r.id, { action: "stop" }, "Stopped")} icon={<PauseIcon size={13} />} label={T("Stop")} />
                    : <SmallBtn onClick={() => act(r.id, { action: "resume" }, "Resumed")} icon={<PlayIcon size={13} />} label={T("Resume")} />}
                  <SmallBtn onClick={() => navigator.clipboard?.writeText(statusMessage(r, now, T)).then(() => say(true, T("Copied")), () => undefined)} icon={<CopyIcon size={13} />} label={T("Status message")} />
                  <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-outline-gray-2 px-2 py-1.5 text-xs hover:bg-surface-gray-1">
                    {T("Details")} <ChevronDownIcon size={13} className={open === r.id ? "rotate-180" : ""} />
                  </button>
                </div>
              </div>
              {open === r.id && (
                <Details r={r} rows={list} evs={evs.filter((e) => e.license_id === r.id)} busy={busy}
                  onChange={(change, done) => act(r.id, change, done)} onError={fail} onSaved={(m) => { say(true, T(m)); load(); }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BackupCard onDone={(m) => { say(true, m); load(); }} onError={fail} />
        <ContactCard value={data.contact ?? ""} onSaved={() => say(true, T("Saved successfully"))} />
        <TwoFactorCard tf={data.twoFactor} reload={load} onError={fail} />
        <Card icon={<HardDriveIcon size={18} />} title={T("Where the codes are kept")}>
          <p className="text-sm text-ink-gray-6">
            {T(data.storage?.source === "license-db" ? "In the codes database of their own (LICENSE)." : "In the embedded database of this server.")}
            {" "}{data.storage?.codes != null ? `${data.storage.codes} ${T("codes")}` : ""}
          </p>
          <button onClick={async () => { const r = await api({ op: "selftest" }); const s = r.storage as Data["storage"]; say(!!s?.ok, s?.ok ? `${T("Saved and read back")} — ${s.roundTripMs} ms` : T("The codes database does not answer.")); }}
            className="mt-3 rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1">{T("Test saving")}</button>
          {data.version != null && <p className="mt-2 text-xs text-ink-gray-5">{T("Latest version")}: <span dir="ltr">build-{data.version}</span></p>}
        </Card>
        <Card icon={<ShieldCheckIcon size={18} />} title={T("Sign-ins to this page")}>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {(data.signIns ?? []).map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className={s.ok ? "text-emerald-700" : "text-red-600"}>{s.ok ? T("Signed in") : T("Refused")}</span>
                <span dir="ltr" className="font-mono text-ink-gray-5">{s.ip}</span>
                <span dir="ltr" className="tabular-nums text-ink-gray-5">{fmtTime(s.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const locale = useLocale();
  return (
    <div className="min-h-screen bg-surface-gray-1">
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-gray-9">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white"><KeyRoundIcon size={18} /></span>
            {t(locale, "Activation codes")}
          </h1>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink-gray-8"><span className="text-brand">{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-outline-gray-2 bg-surface-white p-3">
      <div className="text-xs text-ink-gray-5">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? "text-ink-gray-8"}`}>{value}</div>
    </div>
  );
}

function SmallBtn({ onClick, icon, label, danger }: { onClick: () => void; icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-outline-gray-2 hover:bg-surface-gray-1"}`}>
      {icon} {label}
    </button>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => undefined)}
      className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
      {done ? <CheckIcon size={15} /> : <CopyIcon size={15} />} {label}
    </button>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await api({ op: "login", password, code });
    setBusy(false);
    if (r.ok) return onDone();
    if (r.error === "need_code") setNeedCode(true);
    setErr(t(locale, ERRORS[String(r.error)] ?? "Could not save"));
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-2xl border border-outline-gray-2 bg-surface-white p-6 shadow-sm">
      <p className="text-sm text-ink-gray-6">{t(locale, "The owner's page for the subscribers' codes.")}</p>
      <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
        placeholder={t(locale, "Password")} className="w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-sm outline-none focus:border-brand" />
      {needCode && (
        <input name="code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" dir="ltr" autoComplete="one-time-code"
          placeholder="000000" className="w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-center font-mono tracking-widest outline-none focus:border-brand" />
      )}
      <button disabled={busy || !password} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? t(locale, "Checking…") : t(locale, "Sign in")}
      </button>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </form>
  );
}

function StationChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const locale = useLocale();
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATIONS.map((s) => {
        const on = value.includes(s.id);
        return (
          <button type="button" key={s.id} aria-pressed={on} data-station={s.id} onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? `${s.tone.soft} border-transparent` : "border-outline-gray-2 text-ink-gray-5 line-through"}`}>
            {t(locale, s.label)}
          </button>
        );
      })}
    </div>
  );
}

function CreateForm({ onCreated, onError }: { onCreated: (company: string, code: string) => void; onError: (r: Record<string, unknown>) => void }) {
  const locale = useLocale();
  const [company, setCompany] = useState("");
  const [days, setDays] = useState(365);
  const [seats, setSeats] = useState(1);
  const [mods, setMods] = useState<string[]>([...DEFAULT_STATIONS]);
  const [note, setNote] = useState("");
  const [trial, setTrial] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api({ op: "create", company, days, seats, modules: mods, note, trial });
    setBusy(false);
    if (!r.ok) return onError(r);
    onCreated(company, String(r.code));
    setCompany(""); setNote(""); setTrial(false);
  }
  const cls = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand";
  return (
    <form onSubmit={submit} className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm" data-testid="create-code">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink-gray-8"><PlusIcon size={18} className="text-brand" /> {t(locale, "New code")}</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink-gray-5">{t(locale, "Company")}</span>
          <input name="company" value={company} onChange={(e) => setCompany(e.target.value)} required className={cls} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-gray-5">{t(locale, "Days")}</span>
          <input name="days" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} className={cls} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-gray-5">{t(locale, "Computers")}</span>
          <input name="seats" type="number" min={1} max={100} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={cls} />
        </label>
      </div>
      <div className="mt-3">
        <span className="text-xs text-ink-gray-5">{t(locale, "Stations")}</span>
        <div className="mt-1"><StationChips value={mods} onChange={setMods} /></div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs text-ink-gray-5">{t(locale, "Note (only you see it)")}</span>
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink-gray-7">
          <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} /> {t(locale, "Trial")}
        </label>
      </div>
      <button disabled={busy || !company.trim()} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        <KeyRoundIcon size={15} /> {t(locale, "Make the code")}
      </button>
    </form>
  );
}

const EVENT_LABEL: Record<string, string> = {
  created: "Created", extended: "Extended", activated: "A computer joined", stopped: "Stopped", resumed: "Resumed",
  seats: "Computers changed", device_reset: "A computer's seat freed", modules: "Stations changed", renamed: "Renamed",
  paid: "Paid", unpaid: "Marked unpaid", message: "Message", new_code: "New code", sync: "Database link",
};

function Details({ r, rows, evs, busy, onChange, onError, onSaved }: {
  r: Row; rows: Row[]; evs: Ev[]; busy: boolean;
  onChange: (c: Record<string, unknown>, done?: string) => void;
  onError: (r: Record<string, unknown>) => void;
  onSaved: (m: string) => void;
}) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [company, setCompany] = useState(r.company);
  const [noteText, setNoteText] = useState(r.note);
  const [seats, setSeats] = useState(r.seats);
  const [mods, setMods] = useState(r.modules);
  const [price, setPrice] = useState(r.price);
  const [msg, setMsg] = useState(r.message);
  const [db, setDb] = useState(false);
  const cls = "w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-4 border-t border-outline-gray-2 bg-surface-gray-1/50 p-4 text-sm">
      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Computers using this code")}</div>
        {r.devices.length === 0 ? <p className="text-xs text-ink-gray-5">{T("None yet — the first computer that enters the code starts its period.")}</p> : (
          <ul className="space-y-1.5">
            {r.devices.map((d) => (
              <li key={d.device_id} data-device={d.device_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2">
                <MonitorIcon size={14} className="text-ink-gray-5" />
                <input defaultValue={d.name} placeholder={d.label || T("Name this computer")} aria-label={T("Name this computer")}
                  onBlur={(e) => { if (e.target.value !== d.name) onChange({ action: "device_name", device: d.device_id, name: e.target.value }); }}
                  className="min-w-[10rem] flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-outline-gray-2 focus:border-brand" />
                <span className="text-xs text-ink-gray-5">{d.label}</span>
                <span className="text-xs text-ink-gray-5">{T("Joined")} {fmt(d.activated_at)}</span>
                <span className="text-xs text-ink-gray-5">{T("Last seen")} {fmtTime(d.last_seen_at)}</span>
                {d.app_version && <span dir="ltr" className="rounded bg-surface-gray-2 px-1.5 text-[11px]">{d.app_version}</span>}
                <SmallBtn onClick={() => { if (confirm(T("Free this computer's seat? It will need the code again."))) onChange({ action: "reset_device", device: d.device_id }, "The seat is free"); }}
                  icon={<RotateCcwIcon size={12} />} label={T("Free the seat")} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2"><span className="text-xs text-ink-gray-5">{T("Company")}</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={cls} /></label>
        <label className="block"><span className="text-xs text-ink-gray-5">{T("Computers")}</span>
          <input type="number" min={1} max={100} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={cls} /></label>
        <label className="block sm:col-span-3"><span className="text-xs text-ink-gray-5">{T("Note (only you see it)")}</span>
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} className={cls} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onChange({ action: "rename", company, note: noteText }, "Saved successfully")} className="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-xs hover:bg-surface-gray-1">{T("Save the name")}</button>
        <button disabled={busy || seats === r.seats} onClick={() => onChange({ action: "seats", seats }, "Saved successfully")} className="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-xs hover:bg-surface-gray-1 disabled:opacity-50">{T("Save the computers")}</button>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Stations")}</div>
        <StationChips value={mods} onChange={setMods} />
        <button disabled={busy} onClick={() => onChange({ action: "modules", modules: mods }, "Saved successfully")} className="mt-2 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-xs hover:bg-surface-gray-1">{T("Save the stations")}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Payment")}</div>
          <div className="flex items-center gap-2">
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={T("Amount")} className={cls} />
            <button onClick={() => onChange({ action: "payment", price, paid: !r.paid }, "Saved successfully")} className="shrink-0 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-xs hover:bg-surface-gray-1">
              {r.paid ? T("Mark unpaid") : T("Mark paid")}
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-gray-6">{T("Message to the company's computers")}</div>
          <div className="flex items-center gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={T("Shown at their next check")} className={cls} />
            <button onClick={() => onChange({ action: "message", text: msg }, "Saved successfully")} className="shrink-0 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-xs hover:bg-surface-gray-1">{T("Send")}</button>
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

function DbLink({ r, rows, onError, onSaved }: { r: Row; rows: Row[]; onError: (x: Record<string, unknown>) => void; onSaved: (m: string) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [conn, setConn] = useState("");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState("");
  const linked = rows.filter((x) => x.id !== r.id && x.sync?.by === "owner");
  async function run(op: "sync_test" | "sync_set") {
    setBusy(true); setTested("");
    const res = await api({ op, id: r.id, conn });
    setBusy(false);
    if (!res.ok) return onError(res);
    if (op === "sync_test") setTested(`${T("Connected")} — ${res.host}`);
    else { setConn(""); onSaved("Linked. The company's computers receive it at their next check."); }
  }
  return (
    <div className="space-y-2 rounded-xl border border-outline-gray-2 bg-surface-white p-3" data-testid="db-link">
      <p className="text-xs leading-relaxed text-ink-gray-6">
        {T("Every computer of this company keeps working on its own copy and syncs with this database when online. Paste the Postgres connection string — in Supabase: Connect → Session pooler (port 5432). It is kept sealed; computers receive it with their license.")}
      </p>
      {r.sync && <p className="text-xs text-ink-gray-7">{T("Linked now")}: <span dir="ltr" className="font-mono">{r.sync.host}</span> {r.sync.by === "device" ? `(${T("linked from the computer")})` : ""}</p>}
      <input value={conn} onChange={(e) => setConn(e.target.value)} dir="ltr" placeholder={r.sync ? T("Leave empty to keep the saved address") : "postgresql://…"}
        className="w-full rounded-lg border border-outline-gray-2 px-3 py-1.5 font-mono text-xs outline-none focus:border-brand" />
      <div className="flex flex-wrap gap-2">
        <SmallBtn onClick={() => !busy && run("sync_test")} icon={<RefreshCwIcon size={12} />} label={T("Test")} />
        <SmallBtn onClick={() => !busy && run("sync_set")} icon={<CheckIcon size={12} />} label={T("Test and link")} />
        {r.sync && <SmallBtn danger onClick={async () => { const x = await api({ op: "sync_set", id: r.id, conn: null }); if (x.ok) onSaved("Unlinked"); else onError(x); }} icon={<Trash2Icon size={12} />} label={T("Unlink")} />}
        {linked.length > 0 && (
          <select value="" onChange={async (e) => { const x = await api({ op: "sync_copy", id: r.id, from: e.target.value }); if (x.ok) onSaved("Linked. The company's computers receive it at their next check."); else onError(x); }}
            className="rounded-lg border border-outline-gray-2 px-2 py-1 text-xs">
            <option value="">{T("Same database as…")}</option>
            {linked.map((x) => <option key={x.id} value={x.id}>{x.company}</option>)}
          </select>
        )}
      </div>
      {tested && <p className="text-xs text-emerald-700">{tested}</p>}
    </div>
  );
}

function BackupCard({ onDone, onError }: { onDone: (m: string) => void; onError: (r: Record<string, unknown>) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  return (
    <Card icon={<DatabaseIcon size={18} />} title={T("Backup of the codes")}>
      <p className="text-sm text-ink-gray-6">{T("Codes (as fingerprints), computers, history and the contact line. Restoring adds and updates; it deletes nothing.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={async () => {
          const r = await api({ op: "backup" });
          if (!r.ok) return onError(r);
          const blob = new Blob([JSON.stringify(r.backup, null, 1)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = `spir-codes-${new Date().toLocaleDateString("en-CA")}.json`;
          document.body.appendChild(a); a.click(); a.remove();
        }} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1"><DownloadIcon size={14} /> {T("Download")}</button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1">
          <UploadIcon size={14} /> {T("Restore")}
          <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            let backup: unknown = null;
            try { backup = JSON.parse(await f.text()); } catch { return onError({ error: "invalid" }); }
            const r = await api({ op: "restore", backup });
            if (!r.ok) return onError(r);
            onDone(`${T("Restored")}: ${r.licenses} ${T("codes")}`);
          }} />
        </label>
      </div>
    </Card>
  );
}

function ContactCard({ value, onSaved }: { value: string; onSaved: () => void }) {
  const locale = useLocale();
  const [v, setV] = useState(value);
  return (
    <Card icon={<PhoneIcon size={18} />} title={t(locale, "Contact line")}>
      <p className="text-sm text-ink-gray-6">{t(locale, "Shown on the activation and lock screens of every computer.")}</p>
      <div className="mt-3 flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} className="w-full rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm outline-none focus:border-brand" />
        <button onClick={async () => { await api({ op: "contact", contact: v }); onSaved(); }} className="shrink-0 rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1">{t(locale, "Save")}</button>
      </div>
    </Card>
  );
}

function TwoFactorCard({ tf, reload, onError }: { tf?: TwoFactor; reload: () => void; onError: (r: Record<string, unknown>) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  return (
    <Card icon={<SmartphoneIcon size={18} />} title={T("Two-step sign-in")}>
      <p className="text-sm text-ink-gray-6">
        {T(tf?.enabled ? "On: signing in asks for the code from your authenticator app." : tf?.broken ? "It was set up with another AUTH_SECRET and no longer opens: set it up again." : "Off: the password alone opens this page.")}
      </p>
      {tf?.forcedOff && <p className="mt-1 text-xs text-amber-700">{T("Switched off from the server (LICENSE_2FA_OFF).")}</p>}
      {setup && (
        <div className="mt-3 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="" className="size-44 rounded-lg border border-outline-gray-2" />
          <p dir="ltr" className="break-all font-mono text-xs text-ink-gray-6">{setup.secret}</p>
        </div>
      )}
      {(setup || tf?.enabled) && (
        <input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" inputMode="numeric" placeholder="000000"
          className="mt-3 w-40 rounded-lg border border-outline-gray-2 px-3 py-1.5 text-center font-mono tracking-widest outline-none focus:border-brand" />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!tf?.enabled && !setup && tf?.canSetup && (
          <button onClick={async () => { const r = await api({ op: "totp_setup" }); if (!r.ok) return onError(r); setSetup({ secret: String(r.secret), qr: String(r.qr) }); }}
            className="rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1">{T("Set up")}</button>
        )}
        {setup && (
          <button onClick={async () => { const r = await api({ op: "totp_enable", code }); if (!r.ok) return onError(r); setSetup(null); setCode(""); reload(); }}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">{T("Confirm")}</button>
        )}
        {tf?.enabled && (
          <button onClick={async () => { const r = await api({ op: "totp_disable", code }); if (!r.ok) return onError(r); setCode(""); reload(); }}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">{T("Turn off")}</button>
        )}
      </div>
    </Card>
  );
}

/** A short status the owner sends the company (WhatsApp): period, computers, stations. */
function statusMessage(r: Row, now: number, T: (k: string) => string): string {
  const st = stateOf(r, now);
  const lines = [
    `${r.company} — ${T(STATE_LABEL[st])}`,
    r.expires_at ? `${T("until")} ${fmt(r.expires_at)}` : `${r.duration_days} ${T("days from the first computer")}`,
    `${T("Computers")}: ${r.devices.length}/${r.seats}`,
    `${T("Stations")}: ${STATIONS.filter((s) => r.modules.includes(s.id)).map((s) => T(s.label)).join("، ")}`,
  ];
  return lines.join("\n");
}

function downloadCsv(rows: Row[], now: number, T: (k: string) => string) {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = [T("Company"), T("Status"), T("Computers"), T("until"), T("Stations"), T("Payment"), T("Note")];
  const body = rows.map((r) => [
    r.company, T(STATE_LABEL[stateOf(r, now)]), `${r.devices.length}/${r.seats}`, fmt(r.expires_at),
    STATIONS.filter((s) => r.modules.includes(s.id)).map((s) => T(s.label)).join(" · "),
    `${r.paid ? T("Paid") : T("Not paid")}${r.price ? ` ${r.price}` : ""}`, r.note,
  ]);
  const csv = [head, ...body].map((l) => l.map((x) => cell(String(x))).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `spir-codes-${new Date().toLocaleDateString("en-CA")}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
