import type { ReactNode } from "react";
import Link from "next/link";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BanknoteIcon,
  BoxesIcon,
  CloudIcon,
  DatabaseIcon,
  HardDriveIcon,
  MicroscopeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  WifiOffIcon,
} from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { isRemoteConfigured } from "@/lib/db/pglite";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * The landing screen.
 *
 * Spir-Margin is installed at one company and has to be usable on a machine
 * that has neither a hosted database nor an internet connection, so this page
 * says what the system does, states plainly where the data currently lives,
 * and gets out of the way. It is the only page besides sign-in that renders
 * without a session.
 */
export default function WelcomePage() {
  const locale = getLocale();
  const synced = isRemoteConfigured();

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-gray-1">
      <div aria-hidden className="pointer-events-none absolute -top-32 -start-32 size-96 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -end-32 size-[28rem] rounded-full bg-brand-dark/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-12">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="mb-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-lg font-bold text-white shadow-md">
            S
          </span>
          <div>
            <div className="text-lg font-bold tracking-tight text-ink-gray-9">Spir-Margin</div>
            <div className="text-xs text-ink-gray-5">{t(locale, "Medical-device sales, lab tracking & banking.")}</div>
          </div>
        </div>

        {/* ── Headline ─────────────────────────────────────────────── */}
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-snug text-ink-gray-9 sm:text-4xl">
            {t(locale, "Run the whole company from one place.")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-gray-6">
            {t(
              locale,
              "Devices, labs, stock, sales, maintenance and accounts — in one system that keeps working when the network does not.",
            )}
          </p>
        </div>

        {/* ── Where the data is right now ──────────────────────────── */}
        <section className="mt-9 rounded-2xl border border-outline-gray-2 bg-surface-white/95 p-5 shadow-sm backdrop-blur-xl">
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
              ? t(
                  locale,
                  "Your work is saved on this computer first, then sent to the hosted database automatically. Nothing is lost if the connection drops.",
                )
              : t(
                  locale,
                  "Everything is saved on this computer. Add a hosted database later and the work already done here will sync up to it — nothing has to be re-entered.",
                )}
          </p>
        </section>

        {/* ── What it covers ───────────────────────────────────────── */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Capability icon={<MicroscopeIcon size={18} />} title={t(locale, "Devices & labs")}
            desc={t(locale, "Installations, serials, warranty and maintenance visits.")} />
          <Capability icon={<BoxesIcon size={18} />} title={t(locale, "Stock & purchasing")}
            desc={t(locale, "Batches, expiry, warehouses, suppliers and receipts.")} />
          <Capability icon={<BanknoteIcon size={18} />} title={t(locale, "Sales & accounts")}
            desc={t(locale, "Quotations, invoices, payments and the general ledger.")} />
          <Capability icon={<ActivityIcon size={18} />} title={t(locale, "Contracts & support")}
            desc={t(locale, "Service contracts, billing schedules and fault tickets.")} />
        </section>

        {/* ── How it runs ──────────────────────────────────────────── */}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Trait icon={<DatabaseIcon size={16} />} title={t(locale, "Works with no database")}
            desc={t(locale, "The system carries its own database. There is nothing to install or configure to start.")} />
          <Trait icon={<WifiOffIcon size={16} />} title={t(locale, "Works with no internet")}
            desc={t(locale, "Keep working through an outage. Every change is recorded and waits its turn.")} />
          <Trait icon={<RefreshCwIcon size={16} />} title={t(locale, "Syncs when you are ready")}
            desc={t(locale, "Connect a hosted database and the work syncs, automatically or on demand.")} />
        </section>

        {/* ── Way in ───────────────────────────────────────────────── */}
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-dark active:scale-95"
          >
            {t(locale, "Sign in")}
            <ArrowLeftIcon size={16} className="rtl:rotate-180" />
          </Link>
          <span className="inline-flex items-center gap-2 text-xs text-ink-gray-5">
            <ShieldCheckIcon size={14} className="text-brand" />
            {t(locale, "One company, one built-in account — the sign-in page shows it.")}
          </span>
        </div>
      </main>
    </div>
  );
}

function Capability({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-outline-gray-2 bg-surface-white/95 p-4 shadow-sm backdrop-blur-xl">
      <span className="grid size-9 place-items-center rounded-lg bg-brand-light text-brand">{icon}</span>
      <div className="mt-3 text-sm font-semibold text-ink-gray-8">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-ink-gray-5">{desc}</p>
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
