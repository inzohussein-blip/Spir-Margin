"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import type { Notif } from "@/lib/notifications";

const dot: Record<Notif["severity"], string> = {
  red: "bg-red-500", amber: "bg-amber-500", blue: "bg-blue-500",
};

export function NotificationBell({ items, locale = "ar" }: { items: Notif[]; locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = items.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t(locale, "Notifications")}
        className="relative flex size-8 items-center justify-center rounded-md text-ink-gray-6 hover:bg-surface-gray-1"
      >
        <BellIcon size={17} />
        {count > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute end-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-md border border-outline-gray-2 bg-surface-white py-1 shadow-lg">
          <p className="border-b border-outline-gray-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-gray-4">
            {t(locale, "Notifications")}
          </p>
          {count === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-ink-gray-4">{t(locale, "No alerts")}</p>
          ) : (
            items.map((n, i) => (
              <Link
                key={i}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-surface-gray-1"
              >
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot[n.severity]}`} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink-gray-8">{n.title}</span>
                  <span className="block truncate text-xs text-ink-gray-5">{n.sub}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
