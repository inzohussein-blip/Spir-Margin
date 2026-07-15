import type { ReactNode } from "react";
import Link from "next/link";
import { Indicator, type IndicatorColor } from "./Indicator";
import type { Crumb } from "./ListShell";

/**
 * ERPNext "Desk" form-view chrome: breadcrumb, a title bar with an optional
 * status indicator, and a two-column body (main form + a right meta sidebar).
 */
export function FormShell({
  title,
  breadcrumbs = [],
  status,
  statusColor,
  sidebar,
  children,
}: {
  title: string;
  breadcrumbs?: Crumb[];
  status?: string | null;
  statusColor?: IndicatorColor;
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-ink-gray-5">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {c.href ? <Link href={c.href} className="hover:text-brand">{c.label}</Link> : <span>{c.label}</span>}
              {i < breadcrumbs.length - 1 && <span className="text-ink-gray-3">/</span>}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-gray-1 pb-3">
        <h1 className="text-xl font-semibold text-ink-gray-8">{title}</h1>
        {status && (
          <span className="rounded-full border border-outline-gray-2 bg-surface-white px-3 py-1">
            <Indicator status={status} color={statusColor} />
          </span>
        )}
      </div>

      <div className={sidebar ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]" : ""}>
        <div className="min-w-0">{children}</div>
        {sidebar && (
          <aside className="space-y-4">
            <div className="rounded-xl border border-outline-gray-2 bg-surface-white p-4 text-sm shadow-sm">
              {sidebar}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
