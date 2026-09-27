"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, LockIcon, LayoutGridIcon, LayersIcon } from "lucide-react";
import { navGroups, groupSlug } from "@/lib/nav";
import { t, type Locale } from "@/lib/i18n";
import { STATION_COOKIE, stationById } from "@/lib/license/modules";

type StationNav = { id: string; label: string; groups: string[] };

/**
 * The station gone in through: the one in the address on its own home page
 * (kept in the cookie from there on — also when the page came straight from
 * a sign-in, which the middleware does not see), else the cookie. None on
 * the dashboard, which is the whole system.
 */
function currentStation(pathname: string): StationNav | null {
  const clear = () => { document.cookie = `${STATION_COOKIE}=; path=/; max-age=0; samesite=lax`; };
  if (pathname === "/" || pathname === "/station/all") { clear(); return null; }
  const here = /^\/station\/([a-z]+)/.exec(pathname)?.[1];
  if (here) {
    const s = stationById(here);
    if (s) document.cookie = `${STATION_COOKIE}=${s.id}; path=/; max-age=${30 * 86_400}; samesite=lax`;
    return s ? { id: s.id, label: s.label, groups: s.groups } : null;
  }
  const m = document.cookie.match(new RegExp(`(?:^|; )${STATION_COOKIE}=([^;]*)`));
  const s = stationById(m ? decodeURIComponent(m[1]) : null);
  return s ? { id: s.id, label: s.label, groups: s.groups } : null;
}

export function AppNav({
  locale = "ar",
  hidden = [],
  off = [],
  station: initialStation = null,
}: {
  locale?: Locale;
  /** The station gone in through (the main menu): only its sections are shown. */
  station?: StationNav | null;
  /** Feature groups removed from the sidebar entirely. */
  hidden?: string[];
  /** Feature groups shown greyed-out with a lock (disabled / access-denied). */
  off?: string[];
}) {
  const pathname = usePathname();
  // The root layout — and this sidebar with it — is kept across navigations,
  // so the station is read again from the cookie on every page change.
  const [station, setStation] = useState<StationNav | null>(initialStation);
  useEffect(() => { setStation(currentStation(pathname)); }, [pathname]);
  const hiddenSet = new Set(hidden);
  const offSet = new Set(off);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const groups = station ? navGroups.filter((g) => station.groups.includes(g.label)) : navGroups;
  const activeGroup = navGroups.find((g) => g.items.some((i) => isActive(i.href)))?.label;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const itemClass = (active: boolean) =>
    `group relative flex items-center gap-2.5 rounded-lg text-sm font-medium ${
      active
        ? "bg-brand-light text-brand"
        : "text-ink-gray-6 hover:bg-surface-gray-1 hover:text-ink-gray-8"
    }`;
  // Left accent bar on the active item (RTL-aware via logical inset).
  const accent = (active: boolean) =>
    active ? (
      <span className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-brand" aria-hidden />
    ) : null;

  return (
    <nav className="flex flex-col gap-0.5 px-2.5 pb-6">
      {/* Back to the main menu (the stations), from anywhere. */}
      <Link href="/welcome" data-testid="main-menu" className={`${itemClass(false)} mb-1 border border-outline-gray-2 px-3 py-2`}>
        <LayoutGridIcon size={17} className="text-brand" />
        {t(locale, "Main menu")}
      </Link>
      {station && (
        <Link href={`/station/${station.id}`} data-testid="station-nav" className={`${itemClass(pathname === `/station/${station.id}`)} px-3 py-2 font-semibold`}>
          {accent(pathname === `/station/${station.id}`)}
          <LayersIcon size={17} className="text-brand" />
          {t(locale, station.label)}
        </Link>
      )}
      {groups.map((group) => {
        if (hiddenSet.has(group.label)) return null;
        // Disabled / access-denied feature: greyed, locked, non-navigable.
        if (offSet.has(group.label)) {
          return (
            <div
              key={group.label}
              className="mt-2 flex cursor-not-allowed items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-gray-3"
              title={t(locale, "This feature has been disabled by an administrator.")}
            >
              <span className="flex-1">{t(locale, group.label)}</span>
              <LockIcon size={12} className="text-ink-gray-3" />
            </div>
          );
        }
        const isSingle = group.items.length === 1;
        const expanded = open[group.label] ?? (!!station || group.label === activeGroup || group.label === "Home");
        if (isSingle) {
          const item = group.items[0];
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={group.label} href={item.href} className={`${itemClass(active)} px-3 py-2`}>
              {accent(active)}
              <Icon size={17} className={active ? "text-brand" : "text-ink-gray-5 group-hover:text-ink-gray-7"} />
              {t(locale, item.label)}
            </Link>
          );
        }
        return (
          <div key={group.label} className="mt-2">
            <div className="flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-gray-4">
              <Link href={`/w/${groupSlug(group.label)}`} className="flex-1 hover:text-ink-gray-6">
                {t(locale, group.label)}
              </Link>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [group.label]: !expanded }))}
                className="rounded p-0.5 hover:bg-surface-gray-2 hover:text-ink-gray-6"
                aria-label={t(locale, group.label)}
                aria-expanded={expanded}
              >
                <ChevronRightIcon size={13} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
              </button>
            </div>
            {expanded && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`${itemClass(active)} py-1.5 ps-5 pe-3`}>
                      {accent(active)}
                      <Icon size={16} className={active ? "text-brand" : "text-ink-gray-5 group-hover:text-ink-gray-7"} />
                      {t(locale, item.label)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {station && (
        <Link href="/station/all" data-testid="whole-system" className={`${itemClass(false)} mt-3 px-3 py-2 text-xs`}>
          {t(locale, "The whole system")}
        </Link>
      )}
    </nav>
  );
}
