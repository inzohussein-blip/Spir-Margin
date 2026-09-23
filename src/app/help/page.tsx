import Link from "next/link";
import { BookOpenTextIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { HELP_TOPICS } from "@/components/help/topics";

export const dynamic = "force-dynamic";

/**
 * Instructions (تعليمات), under Setup.
 *
 * Each tab is its own address (/help?tab=install), so another page can point
 * straight at the part that answers its question — Settings links to the
 * settings tab — and the tabs work as plain links, with no script needed.
 */
export default function HelpPage({ searchParams }: { searchParams: { tab?: string } }) {
  const locale = getLocale();
  const active = HELP_TOPICS.find((x) => x.id === searchParams.tab) ?? HELP_TOPICS[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-gray-8">
          <BookOpenTextIcon size={22} className="text-brand" />
          {t(locale, "Instructions")}
        </h1>
        <p className="text-sm text-ink-gray-5">{t(locale, "How to install, set up and use Spir-Margin.")}</p>
      </div>

      <nav aria-label={t(locale, "Instructions")} className="flex flex-wrap gap-1.5 border-b border-outline-gray-2 pb-3">
        {HELP_TOPICS.map((topic) => {
          const on = topic.id === active.id;
          return (
            <Link
              key={topic.id}
              href={`/help?tab=${topic.id}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                on ? "bg-brand text-white" : "text-ink-gray-6 hover:bg-surface-gray-2 hover:text-ink-gray-8"
              }`}
            >
              <topic.icon size={15} />
              {topic.title}
            </Link>
          );
        })}
      </nav>

      <div>{active.render(locale)}</div>
    </div>
  );
}
