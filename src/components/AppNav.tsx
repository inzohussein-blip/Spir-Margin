"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { navGroups } from "@/lib/nav";
import { t, type Locale } from "@/lib/i18n";

export function AppNav({ locale = "ar" }: { locale?: Locale }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
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
      {navGroups.map((group) => {
        const isSingle = group.items.length === 1;
        const expanded = open[group.label] ?? (group.label === activeGroup || group.label === "Home");
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
              <Link href={`/w/${group.label.toLowerCase()}`} className="flex-1 hover:text-ink-gray-6">
                {t(locale, group.label)}
              </Link>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [group.label]: !expanded }))}
                className="rounded p-0.5 hover:bg-surface-gray-2 hover:text-ink-gray-6"
                aria-label={`Toggle ${group.label}`}
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
    </nav>
  );
}
