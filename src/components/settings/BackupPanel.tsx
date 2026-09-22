"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { DownloadIcon, UploadIcon, Loader2Icon, AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { restoreBackupAction, type RestoreState } from "@/app/actions/backup";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

function RestoreButton({ armed }: { armed: boolean }) {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !armed}
      className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <UploadIcon size={15} />}
      {pending ? t(locale, "Restoring…") : t(locale, "Restore this backup")}
    </button>
  );
}

/**
 * Backup and restore for the embedded database.
 *
 * With no hosted database configured, every record the company has is in one
 * folder on this computer. Taking a copy is the only thing standing between a
 * failed disk and starting over, so it is one click and the panel says
 * plainly what the file is.
 */
export function BackupPanel({ synced }: { synced: boolean }) {
  const locale = useLocale();
  const [state, formAction] = useFormState(restoreBackupAction, null as RestoreState | null);
  const [armed, setArmed] = useState(false);

  return (
    <div className="space-y-5 p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-gray-8">{t(locale, "Take a backup")}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-gray-6">
          {synced
            ? t(locale, "A copy of everything on this computer. The hosted database already holds a second copy, but a backup also captures the moment you took it.")
            : t(locale, "A copy of everything on this computer. No hosted database is configured, so this file is the only other copy of the company's records — keep it somewhere else.")}
        </p>
        <a
          href="/api/backup"
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-95"
        >
          <DownloadIcon size={15} />
          {t(locale, "Download a backup")}
        </a>
      </div>

      <div className="border-t border-outline-gray-2 pt-5">
        <h3 className="text-sm font-semibold text-ink-gray-8">{t(locale, "Restore a backup")}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-gray-6">
          {t(locale, "This replaces everything currently on this computer with the contents of the file. There is no undo.")}
        </p>

        <form action={formAction} className="mt-3 space-y-3">
          <input
            type="file"
            name="backup"
            accept=".gz,.tar.gz,application/gzip"
            required
            className="block w-full max-w-md cursor-pointer rounded-md border border-outline-gray-2 bg-surface-white p-2 text-sm text-ink-gray-7 file:me-3 file:rounded file:border-0 file:bg-surface-gray-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-gray-7"
          />
          <label className="flex items-start gap-2 text-sm text-ink-gray-7">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              checked={armed}
              onChange={(e) => setArmed(e.target.checked)}
              className="mt-0.5 size-4 rounded border-outline-gray-3 text-red-600"
            />
            <span>{t(locale, "I understand the current data will be replaced")}</span>
          </label>
          <RestoreButton armed={armed} />
        </form>

        {state?.error ? (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
            <span>{t(locale, state.error)}</span>
          </div>
        ) : null}
        {state?.ok ? (
          <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <CheckCircle2Icon size={16} className="mt-0.5 shrink-0" />
            <span>{t(locale, state.message ?? "The backup was restored")}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
