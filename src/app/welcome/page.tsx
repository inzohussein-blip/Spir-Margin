import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon, CloudIcon, DatabaseIcon, FactoryIcon, HardDriveIcon, LandmarkIcon, LockIcon, PackageIcon,
  PhoneIcon, RefreshCwIcon, ShieldCheckIcon, ShoppingCartIcon, WifiOffIcon, WrenchIcon, type LucideIcon,
} from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { isRemoteConfigured } from "@/lib/db/pglite";
import { getBranding } from "@/lib/branding";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import { deviceState, deviceInfo, licenseTick } from "@/lib/license/device";
import type { DeviceState } from "@/lib/license/state";
import { LicensePanel } from "@/components/license/LicensePanel";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  sales: ShoppingCartIcon, supply: PackageIcon, service: WrenchIcon, manufacturing: FactoryIcon, accounts: LandmarkIcon,
};

/**
 * The landing screen, and where a computer is activated.
 *
 * It shows who the program belongs to, the stations it opens (each a bundle
 * of the sidebar's sections, in the app's own colours), where the data lives
 * right now, and the way in. On a computer waiting for its activation code,
 * or locked, the code window sits over it (src/components/license).
 */
export default async function WelcomePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const locale = getLocale();
  // A fresh answer from the codes server when it comes quickly; offline, the saved one.
  await Promise.race([licenseTick().catch(() => undefined), new Promise((r) => setTimeout(r, 2500))]);
  const [synced, brand, license, info] = await Promise.all([
    isRemoteConfigured(),
    getBranding(),
    deviceState().catch(() => ({ kind: "off" }) as DeviceState),
    deviceInfo().catch(() => ({ message: "", contact: "", version: "", server: "" })),
  ]);
  const name = brand.companyName || "Spir-Margin";
  const open = license.kind === "ok" ? license.mods : null;
  const showStatus = !!searchParams?.license;

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-gray-1">
      <div aria-hidden className="pointer-events-none absolute -top-32 -start-32 size-96 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -end-32 size-[28rem] rounded-full bg-brand-dark/10 blur-3xl" />

      <main className="relative mx-auto w-full max-w-6xl px-5 py-10">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo} alt="" className="size-12 rounded-xl object-contain" />
            ) : (
              <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-xl font-bold text-white shadow-md">S</span>
            )}
            <div>
              <div className="text-xl font-bold tracking-tight text-ink-gray-9">{name}</div>
              <div className="text-xs text-ink-gray-5">{brand.tagline || t(locale, "Medical-device sales, lab tracking & banking.")}</div>
            </div>
          </div>
          {license.kind === "ok" && (
            <Link href="/welcome?license=1" data-testid="license-chip"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:border-emerald-400">
              <ShieldCheckIcon size={14} /> {license.company} · {t(locale, "until")} {new Date(license.until).toLocaleDateString("en-CA")}
            </Link>
          )}
        </div>

        {/* ── Headline ─────────────────────────────────────────────── */}
        <div className="mt-9 max-w-2xl">
          <h1 className="text-3xl font-bold leading-snug text-ink-gray-9 sm:text-4xl">{t(locale, "Run the whole company from one place.")}</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-gray-6">
            {t(locale, "Choose a station to go in. Each one opens its part of the system; everything is saved on this computer first and keeps working when the network does not.")}
          </p>
        </div>

        {/* ── Stations ─────────────────────────────────────────────── */}
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="stations">
          {STATIONS.map((s) => {
            const Icon = ICONS[s.id] ?? ShoppingCartIcon;
            const closed = open != null && !open.includes(s.id);
            const body = (
              <>
                {closed && (
                  <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full bg-surface-gray-2 px-2 py-0.5 text-xs font-medium text-ink-gray-6">
                    <LockIcon size={11} /> {t(locale, "Not in your code")}
                  </span>
                )}
                <span className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${s.tone.icon} text-white shadow-sm`}><Icon size={22} /></span>
                <div className="mt-4 text-lg font-bold text-ink-gray-9">{t(locale, s.label)}</div>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-gray-6">{t(locale, s.desc)}</p>
                <span className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${closed ? "bg-ink-gray-4" : s.tone.button}`}>
                  {closed ? <><LockIcon size={15} /> {t(locale, "Not in your code")}</> : <>{t(locale, "Go in")} <ArrowLeftIcon size={15} className="rtl:rotate-180" /></>}
                </span>
              </>
            );
            const cls = `group relative flex flex-col rounded-2xl border-2 bg-surface-white/95 p-6 shadow-sm backdrop-blur-xl transition-colors ${s.tone.ring}`;
            return closed ? (
              <div key={s.id} data-station={s.id} data-closed="1" aria-disabled="true" className={`${cls} pointer-events-none opacity-60 grayscale`}>{body}</div>
            ) : (
              <Link key={s.id} data-station={s.id} href={`/login?next=${encodeURIComponent(s.href)}`} className={cls}>{body}</Link>
            );
          })}

          {/* The whole system: the dashboard, with every station the code opens. */}
          <Link href="/login" data-station="all" className="group relative flex flex-col justify-between rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-sm transition-transform hover:-translate-y-0.5">
            <div>
              <span className="grid size-12 place-items-center rounded-xl bg-white/15"><ShieldCheckIcon size={22} /></span>
              <div className="mt-4 text-lg font-bold">{t(locale, "The whole system")}</div>
              <p className="mt-1 text-sm leading-relaxed text-white/80">{t(locale, "The dashboard, the stations your code opens, reports, settings and sync — with your account.")}</p>
            </div>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark">
              {t(locale, "Sign in")} <ArrowLeftIcon size={15} className="rtl:rotate-180" />
            </span>
          </Link>
        </section>

        {/* ── Where the data is right now ──────────────────────────── */}
        <section className="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-white/95 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <HardDriveIcon size={13} />
              {t(locale, "Stored on this computer")}
            </span>
            {synced ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                <CloudIcon size={13} />
                {t(locale, "Syncing with the hosted database")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-gray-2 bg-surface-gray-1 px-2.5 py-1 text-xs font-semibold text-ink-gray-6">
                <WifiOffIcon size={13} />
                {t(locale, "No hosted database yet")}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-gray-6">
            {synced
              ? t(locale, "Your work is saved on this computer first, then sent to the hosted database automatically. Nothing is lost if the connection drops.")
              : t(locale, "Everything is saved on this computer. Add a hosted database later and the work already done here will sync up to it — nothing has to be re-entered.")}
          </p>
        </section>

        {/* ── How it runs ──────────────────────────────────────────── */}
        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <Trait icon={<DatabaseIcon size={16} />} title={t(locale, "Works with no database")}
            desc={t(locale, "The system carries its own database. There is nothing to install or configure to start.")} />
          <Trait icon={<WifiOffIcon size={16} />} title={t(locale, "Works with no internet")}
            desc={t(locale, "Keep working through an outage. Every change is recorded and waits its turn.")} />
          <Trait icon={<RefreshCwIcon size={16} />} title={t(locale, "Syncs when you are ready")}
            desc={t(locale, "Connect a hosted database and the work syncs, automatically or on demand.")} />
        </section>

        {/* ── Contact and version ──────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center gap-2 border-t border-outline-gray-2 pt-6 text-center">
          {info.contact && (
            <div className="inline-flex items-center gap-2 rounded-full border border-outline-gray-2 bg-surface-white px-4 py-2 text-sm font-semibold shadow-sm" dir="auto">
              <PhoneIcon size={14} className="text-brand" /> {info.contact}
            </div>
          )}
          {info.version && (
            <div className="text-[11px] text-ink-gray-5" data-testid="app-version">
              {t(locale, "Version")}: <span dir="ltr" className="tabular-nums">{info.version}</span>
            </div>
          )}
        </div>
      </main>

      <LicensePanel state={license} contact={info.contact} message={info.message} showStatus={showStatus} now={Date.now()} />
    </div>
  );
}

function Trait({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-outline-gray-2 bg-surface-white/60 p-4">
      <span className="mt-0.5 shrink-0 text-brand">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-ink-gray-8">{title}</div>
        <p className="mt-1 text-xs leading-relaxed text-ink-gray-5">{desc}</p>
      </div>
    </div>
  );
}
