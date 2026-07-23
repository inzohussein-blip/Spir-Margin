import type { ReactNode } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { ListFilter } from "./ListFilter";
import { ExportCsvButton } from "./ExportCsvButton";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export interface Crumb { label: string; href?: string; }

/**
 * ERPNext "Desk" list-view chrome: breadcrumb, title + record count, a primary
 * "+ Add" action, an optional actions slot, and a filter bar — wrapping the
 * page's own table (marked with data-desk-list for the quick-filter to target).
 */
export function ListShell({
  title,
  breadcrumbs = [],
  count,
  newHref,
  newLabel = "New",
  actions,
  filterable = true,
  filterPlaceholder,
  children,
}: {
  title: string;
  breadcrumbs?: Crumb[];
  count?: number;
  newHref?: string;
  newLabel?: string;
  actions?: ReactNode;
  filterable?: boolean;
  filterPlaceholder?: string;
  children: ReactNode;
}) {
  const locale = getLocale();
  return (
    <div data-desk-shell className="space-y-4">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-ink-gray-8">{title}</h1>
          {count != null && (
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">{count}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {newHref && (
            <Link
              href={newHref}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-brand-dark hover:shadow-md active:translate-y-0"
            >
              <PlusIcon size={15} /> {newLabel}
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white shadow-sm">
        {filterable && (
          <div className="flex items-center justify-between gap-3 border-b border-outline-gray-1 bg-surface-gray-1/40 px-3 py-2">
            <ListFilter placeholder={filterPlaceholder ?? `${t(locale, "Filter")}…`} />
            <ExportCsvButton title={title} label={t(locale, "Export")} />
          </div>
        )}
        <div data-desk-list className="overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}
