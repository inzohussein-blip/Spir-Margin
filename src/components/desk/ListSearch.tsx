import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

/** Server-side list search: a plain GET form that reloads the list filtered by
 *  ?q= across the whole table (not just the current page). No client JS — it
 *  works by navigating to `basePath?q=…`, which resets paging to page 1. */
export function ListSearch({
  basePath,
  q,
  placeholder,
}: {
  basePath: string;
  q?: string;
  placeholder?: string;
}) {
  const locale = getLocale();
  return (
    <form action={basePath} method="get" className="flex items-center gap-2 border-b border-outline-gray-1 px-4 py-3">
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder ?? `${t(locale, "Search")}…`}
        className="w-full max-w-xs rounded-md border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm text-ink-gray-8 placeholder:text-ink-gray-4 focus:border-brand focus:outline-none"
      />
      <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
        {t(locale, "Search")}
      </button>
      {q ? (
        <a href={basePath} className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-6 hover:bg-surface-gray-1">
          {t(locale, "Clear")}
        </a>
      ) : null}
    </form>
  );
}
