import Link from "next/link";
import { BookOpenIcon, PlusIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { EmptyRow } from "@/components/dashboard/Panel";
import { CATEGORIES, type Category } from "@/lib/guides/core";
import { foldArabic } from "@/lib/text/arabic";
import { CATEGORY_LABEL, GuideTabs, guides } from "@/components/guides/parts";

export const dynamic = "force-dynamic";

export default async function GuidesPage({ searchParams }: { searchParams?: { q?: string; c?: string } }) {
  const locale = getLocale();
  const today = localDate();
  const q = (searchParams?.q ?? "").trim();
  const c = CATEGORIES.includes(searchParams?.c as Category) ? (searchParams?.c as Category) : null;
  const all = await guides();
  const fq = foldArabic(q.toLowerCase());
  const list = all.filter((g) => (!c || g.category === c) && (!q || foldArabic(`${g.title} ${g.purpose ?? ""} ${g.products?.name ?? ""}`.toLowerCase()).includes(fq)));
  return (
    <div className="space-y-5">
      <GuideTabs active="/guides" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Guides")}</h1>
        <Link href="/guides/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"><PlusIcon size={15} /> {t(locale, "New guide")}</Link>
      </div>
      <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder={t(locale, "Search")} className="w-64 rounded-lg border border-outline-gray-2 px-3 py-2" />
        {c && <input type="hidden" name="c" value={c} />}
        <button className="rounded-lg border border-outline-gray-2 px-3 py-2 hover:bg-surface-gray-1">{t(locale, "Search")}</button>
        <span className="mx-1 h-5 w-px bg-outline-gray-2" />
        <Link href={q ? `/guides?q=${encodeURIComponent(q)}` : "/guides"} className={`rounded-full px-3 py-1 ${!c ? "bg-indigo-600 text-white" : "bg-surface-gray-1"}`}>{t(locale, "All")}</Link>
        {CATEGORIES.map((k) => (
          <Link key={k} href={`/guides?c=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-full px-3 py-1 ${c === k ? "bg-indigo-600 text-white" : "bg-surface-gray-1"}`}>{t(locale, CATEGORY_LABEL[k])}</Link>
        ))}
      </form>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white">
          <EmptyRow icon={<BookOpenIcon size={20} />} text={all.length ? t(locale, "No guide matches") : t(locale, "No guides yet")} hint={t(locale, "Write how each device is installed, used and cleaned, how each kit is stored and run, and what to do when something goes wrong.")} actionHref="/guides/new" actionLabel={t(locale, "New guide")} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="guide-list">
          {list.map((g) => (
            <Link key={g.id} href={`/guides/${g.id}`} className="group flex flex-col rounded-2xl border border-outline-gray-2 bg-surface-white p-4 shadow-sm hover:border-indigo-400" data-guide={g.title}>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{t(locale, CATEGORY_LABEL[g.category])}</span>
                <span className="text-ink-gray-5">v{g.version}</span>
                {g.next_review && g.next_review < today && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{t(locale, "Review due")}</span>}
              </div>
              <div className="mt-2 font-semibold text-ink-gray-9 group-hover:text-indigo-700">{g.title}</div>
              {g.purpose && <p className="mt-1 line-clamp-2 text-xs text-ink-gray-6">{g.purpose}</p>}
              <div className="mt-3 text-xs text-ink-gray-5">{g.steps.length} {t(locale, "steps")} · {g.troubles.length} {t(locale, "fixes")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
