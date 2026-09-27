"use client";

import { useState, type ReactNode } from "react";
import {
  RefreshCwIcon, CopyIcon, CheckIcon, Trash2Icon, DatabaseIcon, PhoneIcon, SmartphoneIcon, DownloadIcon, UploadIcon,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import type { PanelRow as Row } from "@/lib/license/panel";

/** The code manager's building blocks (the page is src/app/licenses/page.tsx). */

export type TwoFactor = { enabled: boolean; broken: boolean; forcedOff: boolean; canSetup: boolean };

export const fmt = (ms?: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");
export const fmtTime = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("en-CA", { hour12: false }).replace(",", "") : "—");

export async function api(body: Record<string, unknown>) {
  const r = await fetch("/api/license/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: "error" }))) as Record<string, unknown>;
}

export const ERRORS: Record<string, string> = {
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

export function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink-gray-8"><span className="text-brand">{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-outline-gray-2 bg-surface-white p-3">
      <div className="text-xs text-ink-gray-5">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? "text-ink-gray-8"}`}>{value}</div>
    </div>
  );
}

export function SmallBtn({ onClick, icon, label, danger }: { onClick: () => void; icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-outline-gray-2 hover:bg-surface-gray-1"}`}>
      {icon} {label}
    </button>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => undefined)}
      className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
      {done ? <CheckIcon size={15} /> : <CopyIcon size={15} />} {label}
    </button>
  );
}

export function SignIn({ onDone }: { onDone: () => void }) {
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

export function StationChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
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

export function DbLink({ r, rows, onError, onSaved }: { r: Row; rows: Row[]; onError: (x: Record<string, unknown>) => void; onSaved: (m: string) => void }) {
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

export function BackupCard({ onDone, onError }: { onDone: (m: string) => void; onError: (r: Record<string, unknown>) => void }) {
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

export function ContactCard({ value, onSaved }: { value: string; onSaved: () => void }) {
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

export function TwoFactorCard({ tf, reload, onError }: { tf?: TwoFactor; reload: () => void; onError: (r: Record<string, unknown>) => void }) {
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
