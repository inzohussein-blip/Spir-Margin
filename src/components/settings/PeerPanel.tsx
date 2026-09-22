"use client";

import { useFormState, useFormStatus } from "react-dom";
import { CloudIcon, Loader2Icon, AlertTriangleIcon, CheckCircle2Icon, UnplugIcon, LockIcon } from "lucide-react";
import { savePeerAction, clearPeerAction, type PeerState, type PeerInfo } from "@/app/actions/peer";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

function ConnectButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-95 disabled:opacity-60"
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <CloudIcon size={15} />}
      {pending ? t(locale, "Testing the connection…") : t(locale, "Test and connect")}
    </button>
  );
}

/**
 * Where this machine syncs to.
 *
 * The welcome screen promises a hosted database can be added later; this is
 * where that happens. The address is tested before it is saved, because a
 * wrong one saved is a sync that quietly never works.
 */
export function PeerPanel({ info }: { info: PeerInfo }) {
  const locale = useLocale();
  const [state, formAction] = useFormState(savePeerAction, null as PeerState | null);
  const [clearState, clearAction] = useFormState(
    async () => clearPeerAction(),
    null as PeerState | null,
  );
  const result = state ?? clearState;

  return (
    <div className="space-y-4 p-5">
      {info.configured ? (
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <CloudIcon size={18} className="mt-0.5 shrink-0 text-sky-600" />
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-sky-900">{t(locale, "Connected to a hosted database")}</div>
            <div className="mt-0.5 truncate font-mono text-xs text-sky-800" dir="ltr">{info.summary}</div>
            <p className="mt-1 text-sky-800">
              {t(locale, "Work is saved here first, then synced up automatically.")}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-ink-gray-6">
          {t(locale, "Nothing is configured, so everything stays on this computer. Connect a hosted database to sync with other computers and keep a second copy off this machine.")}
        </p>
      )}

      {info.fromEnvironment ? (
        <div className="flex items-start gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2.5 text-sm text-ink-gray-6">
          <LockIcon size={15} className="mt-0.5 shrink-0 text-ink-gray-4" />
          <span>{t(locale, "This server was deployed with a hosted database, so the address is fixed and cannot be changed here.")}</span>
        </div>
      ) : (
        <>
          <form action={formAction} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Connection string")}</span>
              <input
                type="password"
                name="database_url"
                dir="ltr"
                autoComplete="off"
                placeholder="postgresql://user:password@host:5432/database"
                className="mt-1 block w-full rounded-md border border-outline-gray-2 bg-surface-white px-3 py-2 font-mono text-sm text-ink-gray-8 placeholder:text-ink-gray-4 focus:border-brand focus:outline-none"
              />
              <span className="mt-1 block text-xs text-ink-gray-5">
                {t(locale, "It is tested before it is saved, and never shown again afterwards.")}
              </span>
            </label>
            <ConnectButton />
          </form>

          {info.configured ? (
            <form action={clearAction} className="border-t border-outline-gray-2 pt-4">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-95"
              >
                <UnplugIcon size={15} />
                {t(locale, "Disconnect")}
              </button>
              <p className="mt-1.5 text-xs text-ink-gray-5">
                {t(locale, "Work already synced stays on the hosted database. This computer simply stops sending.")}
              </p>
            </form>
          ) : null}
        </>
      )}

      {result?.error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{t(locale, result.error)}</span>
        </div>
      ) : null}
      {result?.ok ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2Icon size={16} className="mt-0.5 shrink-0" />
          <span>{t(locale, result.message ?? "Saved")}</span>
        </div>
      ) : null}
    </div>
  );
}
