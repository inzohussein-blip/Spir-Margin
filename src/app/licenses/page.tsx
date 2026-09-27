"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyRoundIcon, LogOutIcon, RefreshCwIcon, PlusIcon, ShieldCheckIcon, PhoneIcon, LockIcon, HardDriveIcon,
  FileSpreadsheetIcon, WalletIcon, TagIcon, DatabaseIcon, ActivityIcon, type LucideIcon,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import { arabicIncludes } from "@/lib/text/arabic";
import {
  FILTERS, SORTS, counts as countAll, matches, sortRows, stateOf,
  type Filter, type Sort, type PanelRow as Row, type Plan,
} from "@/lib/license/panel";
import { Card, SignIn, BackupCard, ContactCard, TwoFactorCard, api, fmt, ERRORS, type TwoFactor } from "@/components/licenses/parts";
import { CodeCard, STATE_LABEL } from "@/components/licenses/CodeCard";
import { CreateForm, FreshCode, MoneySection, PricesSection, SignInsCard, ActionsCard, type Fresh, type OwnerAction } from "@/components/licenses/Sections";

/**
 * The code manager («إدارة الرموز») — the owner's page on the codes server
 * (the web version). One code per subscribing company: how many computers,
 * how long, which stations, how long a computer may stay offline; the time
 * left on each, its computers and how their sync stands, reminders and
 * activation messages for WhatsApp, payments with receipts, the owner's
 * prices, and who did what on this page. Signed in with
 * LICENSE_ADMIN_PASSWORD (and an authenticator code once set up); not tied
 * to the app's accounts.
 */

type Ev = { license_id: string; at: number; kind: string; detail: string };
type Data = {
  enabled: boolean; owner: boolean; needsDb?: boolean;
  storage?: { source: string; ok: boolean; codes?: number; error?: string; sealed: boolean; roundTripMs?: number };
  licenses?: Row[]; events?: Ev[]; signIns?: { at: number; ok: boolean; ip: string; agent: string }[];
  actions?: OwnerAction[]; plan?: Plan;
  twoFactor?: TwoFactor; contact?: string; version?: number | null; now?: number;
};

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "codes", label: "Codes", icon: KeyRoundIcon },
  { id: "new", label: "New code", icon: PlusIcon },
  { id: "money", label: "Payments", icon: WalletIcon },
  { id: "prices", label: "Prices", icon: TagIcon },
  { id: "security", label: "Security", icon: ShieldCheckIcon },
  { id: "backup", label: "Backup", icon: DatabaseIcon },
  { id: "contact", label: "Contact line", icon: PhoneIcon },
  { id: "system", label: "System status", icon: ActivityIcon },
];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All", active: "Active", expiring: "Ending soon", expired: "Expired", waiting: "Not used yet", stopped: "Stopped",
  unpaid: "Not paid", trial: "Trial", outdated: "Old version", inactive: "Inactive computers",
};
const FILTER_TONE: Partial<Record<Filter, string>> = { expiring: "text-amber-700", expired: "text-red-700", unpaid: "text-amber-700", inactive: "text-orange-700", outdated: "text-yellow-800" };
const SORT_LABEL: Record<Sort, string> = { expiry: "Nearest expiry", newest: "Newest", name: "Name", seen: "Last seen" };
const EMPTY_PLAN: Plan = { currency: "IQD", stations: {}, seat: 0, trialDays: 7 };

export default function LicensesPage() {
  const locale = useLocale();
  const T = useCallback((k: string) => t(locale, k), [locale]);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("expiry");
  const [section, setSection] = useState("codes");

  const load = useCallback(async () => {
    const r = await fetch("/api/license/admin", { cache: "no-store" });
    setData((await r.json().catch(() => null)) as Data);
  }, []);
  useEffect(() => { load(); }, [load]);
  // The section is kept in the address (#money…), so a reload stays where it was.
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (SECTIONS.some((s) => s.id === h)) setSection(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (id: string) => { setSection(id); try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ } };

  const say = (ok: boolean, text: string) => setNote({ ok, text });
  const fail = (r: Record<string, unknown>) => say(false, T(ERRORS[String(r.error)] ?? "Could not save"));

  async function act(id: string, change: Record<string, unknown>, done?: string) {
    setBusy(true);
    const r = await api({ op: "update", id, change });
    setBusy(false);
    if (!r.ok) return fail(r);
    if (typeof r.code === "string") {
      const row = r.row as Row;
      setFresh({ company: row?.company ?? "", code: r.code, days: row?.duration_days ?? 0, seats: row?.seats ?? 1, modules: row?.modules ?? [], phone: row?.phone ?? "" });
    }
    if (done) say(true, T(done));
    await load();
  }

  const now = data?.now ?? Date.now();
  const latest = data?.version ?? null;
  const list = useMemo(() => data?.licenses ?? [], [data]);
  const rows = useMemo(() => sortRows(list.filter((r) => {
    if (q && !arabicIncludes(`${r.company} ${r.note} ${r.code_hint} ${r.phone} ${r.devices.map((d) => `${d.name} ${d.label}`).join(" ")}`, q)) return false;
    return matches(r, filter, now, latest);
  }), sort), [list, q, filter, sort, now, latest]);

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

  const plan = data.plan ?? EMPTY_PLAN;
  const evs = data.events ?? [];
  const c = countAll(list, now, latest);

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
      <div className="grid gap-5 lg:grid-cols-[13rem_1fr]">
        <nav data-testid="panel-nav" aria-label={T("Sections")}
          className="flex gap-1 overflow-x-auto rounded-2xl border border-outline-gray-2 bg-surface-white p-2 shadow-sm lg:sticky lg:top-4 lg:flex-col lg:self-start">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const on = section === s.id;
            const badge = s.id === "codes" ? c.expiring + c.expired : s.id === "money" ? c.unpaid : 0;
            return (
              <button key={s.id} data-section={s.id} aria-current={on ? "page" : undefined} onClick={() => go(s.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${on ? "bg-brand-light font-semibold text-brand-dark" : "text-ink-gray-7 hover:bg-surface-gray-1"}`}>
                <Icon size={16} /> <span className="flex-1 text-start">{T(s.label)}</span>
                {badge > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
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
          {fresh && <FreshCode f={fresh} contact={data.contact ?? ""} onClose={() => setFresh(null)} />}

          {section === "codes" && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="filter-tiles">
                {FILTERS.map((f) => (
                  <button key={f} data-filter={f} data-count={c[f]} aria-pressed={filter === f} onClick={() => setFilter(f)}
                    className={`rounded-xl border p-2.5 text-start ${filter === f ? "border-brand bg-brand-light" : "border-outline-gray-2 bg-surface-white hover:bg-surface-gray-1"}`}>
                    <div className="truncate text-xs text-ink-gray-5">{T(FILTER_LABEL[f])}</div>
                    <div className={`mt-0.5 text-xl font-bold tabular-nums ${c[f] ? FILTER_TONE[f] ?? "text-ink-gray-8" : "text-ink-gray-4"}`}>{c[f]}</div>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search a company, a computer or the last 4 of a code…")}
                  className="min-w-[14rem] flex-1 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand" />
                <select name="sort" aria-label={T("Sort")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm">
                  {SORTS.map((s) => <option key={s} value={s}>{T(SORT_LABEL[s])}</option>)}
                </select>
                <button onClick={() => downloadCsv(list, now, T)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm hover:bg-surface-gray-1">
                  <FileSpreadsheetIcon size={15} /> {T("Export CSV")}
                </button>
                <button onClick={() => go("new")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                  <PlusIcon size={15} /> {T("New code")}
                </button>
              </div>
              <div className="space-y-3" data-testid="codes">
                {rows.length === 0 && <p className="rounded-lg border border-dashed border-outline-gray-2 p-6 text-center text-sm text-ink-gray-5">{T(list.length ? "No codes match" : "No codes yet")}</p>}
                {rows.map((r) => (
                  <CodeCard key={r.id} r={r} rows={list} evs={evs.filter((e) => e.license_id === r.id)} now={now} latest={latest} plan={plan} busy={busy}
                    onChange={(change, done) => act(r.id, change, done)} onError={fail} onSaved={(m) => { say(true, T(m)); load(); }} say={say} />
                ))}
              </div>
            </>
          )}

          {section === "new" && (
            <CreateForm plan={plan} onError={fail} onCreated={async (f) => { setFresh(f); setFilter("all"); go("codes"); await load(); }} />
          )}

          {section === "money" && <MoneySection rows={list} now={now} plan={plan} onPaid={(id, price) => act(id, { action: "payment", price, paid: true }, "Saved successfully")} />}

          {section === "prices" && <PricesSection plan={plan} onError={fail} onSaved={() => { say(true, T("Saved successfully")); load(); }} />}

          {section === "security" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <TwoFactorCard tf={data.twoFactor} reload={load} onError={fail} />
              <SignInsCard signIns={data.signIns ?? []} />
              <div className="lg:col-span-2"><ActionsCard actions={data.actions ?? []} /></div>
            </div>
          )}

          {section === "backup" && <BackupCard onDone={(m) => { say(true, m); load(); }} onError={fail} />}

          {section === "contact" && <ContactCard value={data.contact ?? ""} onSaved={() => say(true, T("Saved successfully"))} />}

          {section === "system" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card icon={<HardDriveIcon size={18} />} title={T("Where the codes are kept")}>
                <p className="text-sm text-ink-gray-6">
                  {T(data.storage?.source === "license-db" ? "In the codes database of their own (LICENSE)." : "In the embedded database of this server.")}
                  {" "}{data.storage?.codes != null ? `${data.storage.codes} ${T("codes")}` : ""}
                </p>
                <button onClick={async () => { const r = await api({ op: "selftest" }); const s = r.storage as Data["storage"]; say(!!s?.ok, s?.ok ? `${T("Saved and read back")} — ${s.roundTripMs} ms` : T("The codes database does not answer.")); }}
                  className="mt-3 rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1">{T("Test saving")}</button>
              </Card>
              <Card icon={<ActivityIcon size={18} />} title={T("System status")}>
                <dl className="grid grid-cols-2 gap-y-1.5 text-sm" data-testid="system">
                  <dt className="text-ink-gray-5">{T("The codes database")}</dt>
                  <dd className={data.storage?.ok ? "text-emerald-700" : "text-red-600"}>{data.storage?.ok ? T("Answers") : T("Does not answer")}</dd>
                  <dt className="text-ink-gray-5">{T("Sealing key (AUTH_SECRET)")}</dt>
                  <dd className={data.storage?.sealed ? "text-emerald-700" : "text-amber-700"}>{data.storage?.sealed ? T("Set") : T("Not set")}</dd>
                  <dt className="text-ink-gray-5">{T("Two-step sign-in")}</dt>
                  <dd>{data.twoFactor?.enabled ? T("On") : T("Off")}</dd>
                  <dt className="text-ink-gray-5">{T("Latest version")}</dt>
                  <dd dir="ltr" className="text-start tabular-nums">{latest != null ? `build-${latest}` : "—"}</dd>
                  <dt className="text-ink-gray-5">{T("Computers")}</dt>
                  <dd className="tabular-nums">{list.reduce((s, r) => s + r.devices.length, 0)}</dd>
                  <dt className="text-ink-gray-5">{T("Inactive computers")}</dt>
                  <dd className="tabular-nums">{c.inactive}</dd>
                </dl>
                {data.storage && !data.storage.sealed && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {T("AUTH_SECRET is not set: the signing key and the companies' database links are sealed with a local key only. Set AUTH_SECRET on the server.")}
                  </p>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const locale = useLocale();
  return (
    <div className="min-h-screen bg-surface-gray-1">
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
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

function downloadCsv(rows: Row[], now: number, T: (k: string) => string) {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = [T("Company"), T("Status"), T("Computers"), T("until"), T("Stations"), T("Payment"), T("Phone"), T("Note")];
  const body = rows.map((r) => [
    r.company, T(STATE_LABEL[stateOf(r, now)]), `${r.devices.length}/${r.seats}`, fmt(r.expires_at),
    STATIONS.filter((s) => r.modules.includes(s.id)).map((s) => T(s.label)).join(" · "),
    `${r.paid ? T("Paid") : T("Not paid")}${r.price ? ` ${r.price}` : ""}`, r.phone, r.note,
  ]);
  const csv = [head, ...body].map((l) => l.map((x) => cell(String(x))).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `spir-codes-${new Date().toLocaleDateString("en-CA")}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
