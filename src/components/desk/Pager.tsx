import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

/** Default rows per page for the transactional list views. */
export const PAGE_SIZE = 50;

/** Parse a 1-based page number from a searchParams value, clamped to >= 1. */
export function parsePage(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** The inclusive row window for supabase-style .range() for a 1-based page. */
export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  const from = (page - 1) * size;
  return [from, from + size - 1];
}

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  /** Build the href for a given 1-based page, preserving other query params. */
  hrefFor: (page: number) => string;
}

/** ERPNext-style list footer: "Showing X to Y of N" + Prev/Next. Renders
 *  nothing when everything fits on a single page. */
export function Pager({ page, pageSize, total, hrefFor }: PagerProps) {
  const locale = getLocale();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && page <= 1) return null;

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  const btn =
    "rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1";
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between gap-3 border-t border-outline-gray-1 px-4 py-3 text-sm text-ink-gray-5">
      <span>
        {t(locale, "Showing")} {first.toLocaleString()} {t(locale, "to")} {last.toLocaleString()}{" "}
        {t(locale, "of")} {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <Link href={hrefFor(page - 1)} className={`${btn} ${hasPrev ? "" : disabled}`} aria-disabled={!hasPrev}>
          {t(locale, "Previous")}
        </Link>
        <span className="tabular-nums text-ink-gray-4">
          {page} / {pageCount}
        </span>
        <Link href={hrefFor(page + 1)} className={`${btn} ${hasNext ? "" : disabled}`} aria-disabled={!hasNext}>
          {t(locale, "Next")}
        </Link>
      </div>
    </div>
  );
}
