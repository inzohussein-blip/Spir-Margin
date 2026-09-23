import Link from "next/link";
import { RefreshCwIcon, MonitorIcon, Link2Icon, NetworkIcon, CloudIcon, BookOpenTextIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb, remoteUrlIsFromEnvironment } from "@/lib/db/pglite";
import { syncStatus } from "@/lib/sync/engine";
import { lanAddresses, listenerState, readServerSetting } from "@/lib/sync/lan";
import { getPeerInfoAction } from "@/app/actions/peer";
import { Panel } from "@/components/dashboard/Panel";
import { PeerPanel } from "@/components/settings/PeerPanel";
import { LinkPanel } from "@/components/sync/LinkPanel";
import { MainComputerPanel } from "@/components/sync/MainComputerPanel";
import { ShowCode } from "@/components/sync/ShowCode";
import { SyncNowButton } from "@/components/sync/SyncNowButton";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Sync (المزامنة): linking this computer with the company's others.
 *
 * Two ways, which combine: over the office network with a main computer, and
 * over the internet through a hosted database. Either way, linking is one
 * code copied from one computer's page to another's.
 */
export default async function SyncPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return (
      <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-gray-8">{t(locale, "Admins only")}</h1>
        <p className="mt-1 text-sm text-ink-gray-5">{t(locale, "You need an administrator account to manage sync.")}</p>
      </div>
    );
  }

  const [status, server, peerInfo] = await Promise.all([syncStatus(), readServerSetting(), getPeerInfoAction()]);
  const listener = listenerState();
  const { db } = await getDb();
  const clients = (
    await db.query<{ name: string | null; address: string | null; last_seen: string }>(
      `select name, address, last_seen from _spir_lan_clients order by last_seen desc limit 50`,
    )
  ).rows.map((c) => ({ name: c.name, address: c.address, lastSeen: fmtDateTime(c.last_seen) }));

  const linkedTo = status.configured
    ? `${status.kind === "lan" ? t(locale, "the main computer") : t(locale, "the hosted database")} — ${status.label ?? ""}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand"><RefreshCwIcon size={19} /></span>
          <div>
            <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Sync")}</h1>
            <p className="text-sm text-ink-gray-5">{t(locale, "Keep the company's computers in step: over the office network, and between branches over the internet.")}</p>
          </div>
        </div>
        <Link
          href="/help?tab=offline"
          className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm text-ink-gray-7 hover:border-brand hover:text-brand"
        >
          <BookOpenTextIcon size={15} />
          {t(locale, "Sync instructions")}
        </Link>
      </div>

      <Panel title={<span className="flex items-center gap-2"><MonitorIcon size={16} className="text-brand" /> {t(locale, "This computer")}</span>}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-gray-5">{t(locale, "Syncs with")}</dt>
            <dd className="font-medium text-ink-gray-8" data-testid="syncs-with">
              {linkedTo ?? t(locale, "Nothing — everything stays on this computer")}
            </dd>
          </div>
          <div>
            <dt className="text-ink-gray-5">{t(locale, "Main computer of the office")}</dt>
            <dd className="font-medium text-ink-gray-8">
              {server.enabled ? `${t(locale, "Yes")} — ${clients.length} ${t(locale, "computer(s) linked")}` : t(locale, "No")}
            </dd>
          </div>
          {status.configured ? (
            <>
              <div>
                <dt className="text-ink-gray-5">{t(locale, "Last sync")}</dt>
                <dd className="font-medium text-ink-gray-8" dir="ltr">{status.lastSyncAt ? fmtDateTime(status.lastSyncAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-gray-5">{t(locale, "Waiting to be sent")}</dt>
                <dd className="font-medium text-ink-gray-8">{status.pending}</dd>
              </div>
              {status.lastError ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-gray-5">{t(locale, "Last problem")}</dt>
                  <dd className="text-amber-700">{t(locale, status.lastError)}</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
        {status.configured ? (
          <div className="px-4 pb-3">
            <SyncNowButton />
          </div>
        ) : null}
        <p className="px-4 pb-3 text-xs text-ink-gray-5">
          {t(locale, "Sync runs by itself every minute. Details and anything refused are under")}{" "}
          <Link href="/monitoring/sync" className="text-brand hover:underline">{t(locale, "Sync Health")}</Link>.
        </p>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Link2Icon size={16} className="text-brand" /> {t(locale, "Link this computer")}</span>}>
        <div className="p-4">
          <LinkPanel linkedTo={linkedTo} locked={remoteUrlIsFromEnvironment()} />
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><NetworkIcon size={16} className="text-brand" /> {t(locale, "Main computer of the office network")}</span>}>
        <div className="p-4">
          <MainComputerPanel
            enabled={server.enabled}
            running={listener.running}
            error={listener.error}
            port={server.port}
            addresses={lanAddresses()}
            clients={clients}
          />
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><CloudIcon size={16} className="text-brand" /> {t(locale, "Hosted database (branches over the internet)")}</span>}>
        <div className="space-y-4 p-4">
          <PeerPanel info={peerInfo} />
          {status.kind === "hosted" ? (
            <div className="space-y-2 border-t border-outline-gray-1 pt-4">
              <p className="text-sm text-ink-gray-6">{t(locale, "To link a branch computer, paste this code on its Sync page instead of typing the address.")}</p>
              <ShowCode which="pg" />
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
