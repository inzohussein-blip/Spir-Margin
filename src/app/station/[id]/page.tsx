import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutGridIcon, LockIcon } from "lucide-react";
import { navGroups, groupSlug } from "@/lib/nav";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { stationById } from "@/lib/license/modules";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessContext, navFeatureState } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * A station's own home — where its card on the main menu leads. Its sections
 * and their pages, nothing else; the sidebar shows the same (the middleware
 * keeps the station in a cookie). «The whole system» (/station/all) is the
 * dashboard, rewritten there by the middleware.
 */
export default async function StationPage({ params }: { params: { id: string } }) {
  const station = stationById(params.id);
  if (!station) notFound();
  const locale = getLocale();
  const user = await getCurrentUser();
  const access = user ? await getAccessContext(user) : null;
  const nav = access ? navFeatureState(access) : { hidden: [], off: [] };
  const groups = navGroups.filter((g) => station.groups.includes(g.label) && !nav.hidden.includes(g.label));
  return (
    <div className="space-y-6" data-testid="station-home" data-station-home={station.id}>
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 bg-surface-white p-5 shadow-sm ${station.tone.ring}`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink-gray-9">{t(locale, station.label)}</h1>
          <p className="mt-1 text-sm text-ink-gray-6">{t(locale, station.desc)}</p>
        </div>
        <Link href="/welcome" className="inline-flex items-center gap-1.5 rounded-lg border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">
          <LayoutGridIcon size={15} /> {t(locale, "Main menu")}
        </Link>
      </div>
      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-outline-gray-2 p-6 text-center text-sm text-ink-gray-5">
          <LockIcon size={14} className="me-1 inline" /> {t(locale, "Not in your code")}
        </p>
      )}
      {groups.map((g) => {
        const off = nav.off.includes(g.label);
        return (
          <section key={g.label}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-gray-6">
              <Link href={`/w/${groupSlug(g.label)}`} className="hover:text-brand">{t(locale, g.label)}</Link>
              {off && <LockIcon size={12} />}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {g.items.map((item) => {
                const Icon = item.icon;
                const body = (
                  <>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${station.tone.icon} text-white`}><Icon size={18} /></span>
                    <span className="font-semibold text-ink-gray-8">{t(locale, item.label)}</span>
                  </>
                );
                return off ? (
                  <div key={item.href} className="flex items-center gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-3 opacity-50">{body}</div>
                ) : (
                  <Link key={item.href} href={item.href} data-tile={item.href}
                    className="flex items-center gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-3 shadow-sm transition-colors hover:border-brand/50 hover:bg-brand-light/40">
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
