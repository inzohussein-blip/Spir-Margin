"use client";

import { useEffect, useState } from "react";
import { HomeIcon, LogOutIcon, RefreshCwIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { useRoute, useRuntime } from "./hooks";
import { Activate, Booting, Failed, Locked, SignIn } from "./Gate";
import { SyncChip } from "./parts";
import { Home, InvoiceDetail, Invoices, LabNew, Labs, LOCAL_PAGES, Products, Sales, SyncInfo } from "./screens";
import { LocalPos } from "./Pos";

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
  return mounted ? <Phases /> : null;
}

function Phases() {
  const rt = useRuntime(["phase", "user"]);
  useEffect(() => { if (rt.phase === "starting") void rt.start(); }, [rt]);
  useEffect(() => { if (rt.phase === "ready") void keepForOffline(); }, [rt.phase]);

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

/**
 * The page's own code and the engine, put in the offline worker's caches now:
 * what loaded before the worker took charge of this page would otherwise be
 * missing the first time the app is opened without the internet.
 */
async function keepForOffline() {
  try {
    if (!("caches" in window)) return;
    const own = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.startsWith(location.origin));
    const assets = await caches.open("spir-assets-v2");
    const engine = await caches.open("spir-engine-v1");
    const shell = await caches.open("spir-shell-v1");
    for (const u of own) {
      const path = new URL(u).pathname;
      const cache = path.startsWith("/_next/static/") ? assets : path.startsWith("/pglite/") ? engine : path.startsWith("/spir/") ? shell : null;
      if (cache && !(await cache.match(u))) await cache.add(u).catch(() => undefined);
    }
    if (!(await shell.match(`${location.origin}/app`))) await shell.add("/app").catch(() => undefined);
  } catch { /* best effort */ }
}

function Shell() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["user", "license"]);
  const { path, go } = useRoute();

  // The point of sale is full-screen, with its own header.
  if (path === "/pos") return <LocalPos />;

  const links = [...(LOCAL_PAGES.sales ?? []), { href: "#/sync", label: "Sync", icon: RefreshCwIcon }];
  const invoice = /^\/invoices\/([^/]+)$/.exec(path)?.[1];
  const page = invoice ? <InvoiceDetail id={invoice} />
    : path === "/sales" ? <Sales />
    : path === "/labs" ? <Labs />
    : path === "/labs/new" ? <LabNew go={go} />
    : path === "/products" ? <Products />
    : path === "/invoices" ? <Invoices />
    : path === "/sync" ? <SyncInfo />
    : <Home />;

  return (
    <div className="flex min-h-screen" data-testid="local-app">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-e border-outline-gray-2 bg-surface-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold text-ink-gray-8">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
          Spir-Margin
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          <a href="#/" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${path === "/" ? "bg-brand-light font-semibold text-brand" : "text-ink-gray-7 hover:bg-surface-gray-1"}`}>
            <HomeIcon size={16} /> {T("Main menu")}
          </a>
          {links.map((l) => {
            const Icon = l.icon;
            const on = path === l.href.slice(1) || path.startsWith(l.href.slice(1) + "/");
            return (
              <a key={l.href} href={l.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${on ? "bg-brand-light font-semibold text-brand" : "text-ink-gray-7 hover:bg-surface-gray-1"}`}>
                <Icon size={16} /> {T(l.label)}
              </a>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-outline-gray-2 bg-surface-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <a href="#/" className="md:hidden" aria-label={T("Main menu")}><HomeIcon size={18} /></a>
            <span className="truncate font-semibold text-ink-gray-8" data-testid="local-company">{rt.license?.company || "Spir-Margin"}</span>
          </div>
          <div className="flex items-center gap-2">
            <SyncChip />
            <span className="hidden text-sm text-ink-gray-6 sm:inline">{rt.user?.name}</span>
            <button type="button" onClick={() => rt.signOut()} title={T("Sign out")} className="rounded-md p-1.5 text-ink-gray-5 hover:bg-surface-gray-1">
              <LogOutIcon size={16} />
            </button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-outline-gray-2 bg-surface-white px-3 py-2 md:hidden">
          {links.map((l) => <a key={l.href} href={l.href} className="shrink-0 rounded-md px-2.5 py-1 text-sm text-ink-gray-7 hover:bg-surface-gray-1">{T(l.label)}</a>)}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{page}</main>
      </div>
    </div>
  );
}
