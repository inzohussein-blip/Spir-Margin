"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HomeIcon, KeyRoundIcon, ListIcon, LogOutIcon, RefreshCwIcon, type LucideIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { useRoute, useRuntime } from "./hooks";
import { runtime } from "@/lib/local/runtime";
import { Activate, Booting, Failed, Locked, SignIn } from "./Gate";
import { SyncChip } from "./parts";
import { DevicePage, Home, Sales, StationHome } from "./screens";
import { LicenseNotices, LicensePage } from "./License";
import { ThemeApplier } from "./theme";
import { EntityForm, EntityList, EntityRecord, ICONS } from "./entity";
import { Attendance, Guides, Temperatures } from "./daily";
import { entityById, stationPages } from "@/lib/local/registry";
import { STATIONS } from "@/lib/license/modules";
import { LocalPos } from "./Pos";
import { AppInstall } from "./AppInstall";

/**
 * The web version as an app: opened once with the company's code, it settles
 * in this browser (its database, its code, its engine) and opens from then on
 * with the internet or without it. Pages are addressed after the # so that
 * the one page the site serves (/app) holds them all, offline too.
 */
export function LocalApp() {
  // Everything here lives in the browser: the server renders nothing of it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <><ThemeApplier /><ErrorReports /><Phases /><AppInstall /></> : null;
}

/** Errors on this page go to the site's owner while the owner keeps the error log (runtime.reportError). */
function ErrorReports() {
  useEffect(() => {
    const rt = runtime();
    const onError = (e: ErrorEvent) => rt.reportError(String(e.message || e.error || "error"));
    const onReject = (e: PromiseRejectionEvent) => rt.reportError(String((e.reason as Error)?.message ?? e.reason ?? "rejection"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}

function Phases() {
  const rt = useRuntime(["phase", "user"]);
  useEffect(() => { if (rt.phase === "starting") void rt.start(); }, [rt]);

  switch (rt.phase) {
    case "starting":
    case "opening":
    case "first_sync":
      return <Booting rt={rt} />;
    case "need_code":
      return <Activate rt={rt} />;
    case "sign_in":
      return <SignIn rt={rt} />;
    case "locked":
      return <Locked rt={rt} />;
    case "failed":
      return <Failed rt={rt} />;
    default:
      return <Shell />;
  }
}

/** The page for an address after the #, and the station it belongs to. */
function route(path: string): { page: ReactNode; station: string | null } {
  const m = /^\/e\/([^/]+)(?:\/([^/]+))?(?:\/(edit))?$/.exec(path);
  if (m) {
    const e = entityById(m[1]);
    if (!e) return { page: <Home />, station: null };
    const [, , rid, edit] = m;
    const page = !rid ? <EntityList key={e.id} e={e} />
      : rid === "new" ? <EntityForm key={`${e.id}-new`} e={e} />
      : edit ? <EntityForm key={`${e.id}-${rid}-edit`} e={e} id={rid} />
      : <EntityRecord key={`${e.id}-${rid}`} e={e} id={rid} />;
    return { page, station: e.station };
  }
  const st = /^\/s\/([a-z]+)$/.exec(path)?.[1];
  if (st && STATIONS.some((x) => x.id === st)) return { page: <StationHome key={st} id={st} />, station: st };
  const guide = /^\/guides\/([^/]+)$/.exec(path)?.[1];
  if (guide) return { page: <Guides id={guide} />, station: "guides" };
  switch (path) {
    case "/sales": return { page: <Sales />, station: "sales" };
    case "/attendance": return { page: <Attendance />, station: "hr" };
    case "/temperatures": return { page: <Temperatures />, station: "coldchain" };
    case "/guides": return { page: <Guides />, station: "guides" };
    case "/license": return { page: <LicensePage />, station: null };
    case "/device": case "/sync": return { page: <DevicePage />, station: null };
    default: return { page: <Home />, station: "" };
  }
}

const STATION_KEY = "spir.local.station";

function Shell() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["user", "license"]);
  const { path } = useRoute();
  const { page, station: routed } = route(path);
  // The station gone into is remembered: the pages outside every station
  // (the code, this device) keep its sidebar; the main menu clears it.
  const [kept, setKept] = useState<string>(() => { try { return localStorage.getItem(STATION_KEY) ?? ""; } catch { return ""; } });
  useEffect(() => {
    if (routed === null) return;
    setKept(routed);
    try { localStorage.setItem(STATION_KEY, routed); } catch { /* ignore */ }
  }, [routed]);

  // The point of sale is full-screen, with its own header.
  if (path === "/pos") return <><LocalPos /><Arrivals /></>;

  const station = routed ?? kept;
  const current = STATIONS.find((s) => s.id === station) ?? null;
  const mods = rt.license?.mods ?? [];
  const open = STATIONS.filter((s) => !mods.length || mods.includes(s.id));
  const link = (href: string, label: string, icon: string | LucideIcon, key = href) => {
    const Icon = typeof icon === "string" ? ICONS[icon] ?? ListIcon : icon;
    const target = href.slice(1);
    const on = target === "/" ? path === "/" : path === target || path.startsWith(target + "/");
    return (
      <a key={key} href={href} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${on ? "bg-brand-light font-semibold text-brand" : "text-ink-gray-7 hover:bg-surface-gray-1"}`}>
        <Icon size={15} /> {T(label)}
      </a>
    );
  };
  const here = current ? stationPages(current.id) : [];

  return (
    <div className="flex min-h-screen" data-testid="local-app" data-station={current?.id ?? ""}>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-outline-gray-2 bg-surface-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold text-ink-gray-8">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
          Spir-Margin
        </div>
        <nav className="flex-1 space-y-0.5 px-3 pb-6" data-testid="local-nav">
          {link("#/", "Main menu", HomeIcon)}
          {current ? (
            <div className="pt-3">
              <a href={`#/s/${current.id}`} className={`mb-1 block rounded-lg px-3 py-1.5 text-xs font-bold ${current.tone.soft}`}>{T(current.label)}</a>
              {here.map((p) => link(p.href, p.label, p.icon, `${current.id}${p.href}`))}
            </div>
          ) : null}
          <div className="pt-3">
            <div className="px-3 pb-1 text-[11px] font-semibold text-ink-gray-4">{T(current ? "Other stations" : "Stations")}</div>
            {open.filter((s) => s.id !== current?.id).map((s) => (
              <a key={s.id} href={`#/s/${s.id}`} data-nav-station={s.id} className="block rounded-lg px-3 py-1.5 text-sm text-ink-gray-6 hover:bg-surface-gray-1">{T(s.label)}</a>
            ))}
          </div>
          <div className="space-y-0.5 border-t border-outline-gray-1 pt-3">
            {link("#/license", "Activation code", KeyRoundIcon)}
            {link("#/device", "This device and sync", RefreshCwIcon)}
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-outline-gray-2 bg-surface-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <a href="#/" className="md:hidden" aria-label={T("Main menu")}><HomeIcon size={18} /></a>
            <span className="truncate font-semibold text-ink-gray-8" data-testid="local-company">{rt.license?.company || "Spir-Margin"}</span>
            {current && <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${current.tone.soft}`}>{T(current.label)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Connection />
            <SyncChip />
            <span className="hidden text-sm text-ink-gray-6 sm:inline">{rt.user?.name}</span>
            <button type="button" onClick={() => rt.signOut()} title={T("Sign out")} className="rounded-md p-1.5 text-ink-gray-5 hover:bg-surface-gray-1">
              <LogOutIcon size={16} />
            </button>
          </div>
        </header>
        <LicenseNotices />
        <nav className="flex gap-1 overflow-x-auto border-b border-outline-gray-2 bg-surface-white px-3 py-2 md:hidden">
          {(here.length ? here : open.map((s) => ({ href: `#/s/${s.id}`, label: s.label }))).map((l) => (
            <a key={l.href} href={l.href} className="shrink-0 rounded-md px-2.5 py-1 text-sm text-ink-gray-7 hover:bg-surface-gray-1">{T(l.label)}</a>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{page}</main>
      </div>
      <Arrivals />
    </div>
  );
}

/** Online or not, at a glance (the sync chip says where the records stand). */
function Connection() {
  const locale = useLocale();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  return (
    <span data-testid="connection" data-online={online ? "1" : "0"} title={t(locale, online ? "Connected to the internet" : "Without internet")}
      className={`hidden items-center gap-1 text-xs sm:inline-flex ${online ? "text-emerald-700" : "text-amber-700"}`}>
      <span className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} /> {t(locale, online ? "Online" : "Offline")}
    </span>
  );
}

/** Records that arrived from the company's other devices: said for a moment (the pages already show them). */
function Arrivals() {
  const locale = useLocale();
  const rt = useRuntime(["sync"]);
  const [shown, setShown] = useState<{ n: number; at: number } | null>(null);
  const last = useRef<number | null>(null);
  useEffect(() => {
    const at = rt.sync.lastAt;
    if (at && at !== last.current) {
      if (last.current !== null && rt.sync.pulled > 0) setShown({ n: rt.sync.pulled, at });
      last.current = at;
    }
  }, [rt.sync.lastAt, rt.sync.pulled]);
  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(id);
  }, [shown]);
  if (!shown) return null;
  return (
    <div role="status" data-testid="arrivals" className="no-print fixed bottom-4 end-4 z-[65] flex items-center gap-2 rounded-xl border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm shadow-xl">
      <RefreshCwIcon size={15} className="text-brand" />
      {t(locale, "Changes arrived from the company's other devices")}: <b className="tabular-nums">{shown.n}</b>
    </div>
  );
}
