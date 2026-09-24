"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon, SaveIcon, DownloadIcon, HardDriveDownloadIcon, AlertTriangleIcon } from "lucide-react";
import { saveAutoBackupAction, backupNowAction, type AutoBackupState } from "@/app/actions/autobackup";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface AutoBackupView {
  enabled: boolean;
  frequency: "hours" | "daily" | "weekly";
  everyHours: number;
  atTime: string;
  weekday: number;
  folder: string | null;
  defaultFolder: string;
  keep: number;
  lastRunAt: string | null;
  lastFile: string | null;
  lastError: string | null;
  nextAt: string | null;
  files: { name: string; size: number; at: string; kind: "auto" | "before-restore" | "before-update" }[];
}

function Save() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <SaveIcon size={15} />}
      {t(locale, "Save the schedule")}
    </button>
  );
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** When and where this computer backs itself up, and what it has kept. */
export function AutoBackupPanel({ v }: { v: AutoBackupView }) {
  const locale = useLocale();
  const [state, action] = useFormState(saveAutoBackupAction, null as AutoBackupState | null);
  const [freq, setFreq] = useState(v.frequency);
  const [nowState, setNowState] = useState<AutoBackupState | null>(null);
  const [busy, start] = useTransition();
  const err = state ?? nowState;

  return (
    <div className="space-y-5 p-5">
      <div className="rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-4 py-3 text-sm">
        {v.lastError ? (
          <p className="flex items-start gap-2 text-amber-800">
            <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
            <span>
              {t(locale, "The last automatic backup failed.")}{" "}
              <span dir="ltr" className="font-mono text-xs">{v.lastError}</span>
            </span>
          </p>
        ) : v.lastRunAt ? (
          <p className="text-ink-gray-7">
            {t(locale, "Last automatic backup")}: <span dir="ltr">{v.lastRunAt}</span>{" "}
            <span dir="ltr" className="font-mono text-xs text-ink-gray-5">{v.lastFile}</span>
          </p>
        ) : (
          <p className="text-ink-gray-7">{t(locale, "No automatic backup yet.")}</p>
        )}
        <p className="mt-1 text-ink-gray-7">
          {v.enabled
            ? <>{t(locale, "Next")}: <span dir="ltr">{v.nextAt ?? "—"}</span></>
            : t(locale, "Automatic backups are off.")}
        </p>
      </div>

      <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="enabled" defaultChecked={v.enabled} className="size-4 accent-[var(--brand,#4f46e5)]" />
          <span className="font-medium text-ink-gray-8">{t(locale, "Back up automatically")}</span>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">{t(locale, "How often")}</span>
          <select name="frequency" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} className={cls}>
            <option value="hours">{t(locale, "Every few hours")}</option>
            <option value="daily">{t(locale, "Every day")}</option>
            <option value="weekly">{t(locale, "Every week")}</option>
          </select>
        </label>

        {freq === "hours" ? (
          <label className="block text-sm">
            <span className="font-medium text-ink-gray-8">{t(locale, "Every how many hours")}</span>
            <input name="every_hours" type="number" min={1} max={168} defaultValue={v.everyHours} dir="ltr" className={cls} />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-ink-gray-8">{t(locale, "At")}</span>
              <input name="at_time" type="time" defaultValue={v.atTime} dir="ltr" lang="en-GB" className={cls} />
            </label>
            {freq === "weekly" ? (
              <label className="block text-sm">
                <span className="font-medium text-ink-gray-8">{t(locale, "On")}</span>
                <select name="weekday" defaultValue={v.weekday} className={cls}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{t(locale, d)}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        )}
        {freq !== "hours" ? <input type="hidden" name="every_hours" value={v.everyHours} /> : <input type="hidden" name="at_time" value={v.atTime} />}
        {freq !== "weekly" ? <input type="hidden" name="weekday" value={v.weekday} /> : null}

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-ink-gray-8">{t(locale, "Folder")}</span>
          <input name="folder" defaultValue={v.folder ?? ""} placeholder={v.defaultFolder} dir="ltr" className={`${cls} font-mono text-xs`} />
          <span className="mt-1 block text-xs text-ink-gray-5">
            {t(locale, "Empty: the backups folder inside the program's folder. Better: another drive, a USB stick or a shared folder, e.g. D:\\Spir-Backups — a copy on the same disk is lost with it.")}
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">{t(locale, "Copies to keep")}</span>
          <input name="keep" type="number" min={1} max={365} defaultValue={v.keep} dir="ltr" className={cls} />
        </label>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          <Save />
          <button
            type="button"
            disabled={busy}
            onClick={() => start(async () => setNowState((await backupNowAction()) ?? null))}
            className="inline-flex items-center gap-2 rounded-md border border-outline-gray-2 px-4 py-2 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {busy ? <Loader2Icon size={15} className="animate-spin" /> : <HardDriveDownloadIcon size={15} />}
            {t(locale, "Back up now")}
          </button>
        </div>
      </form>

      {err?.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(locale, err.error)}
          {err.detail ? <span dir="ltr" className="mt-1 block font-mono text-xs">{err.detail}</span> : null}
        </p>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-gray-8">{t(locale, "Kept backups")}</h3>
        {v.files.length === 0 ? (
          <p className="text-sm text-ink-gray-5">{t(locale, "None yet.")}</p>
        ) : (
          <ul className="divide-y divide-outline-gray-1 rounded-md border border-outline-gray-1 text-sm" data-testid="backup-files">
            {v.files.map((f) => (
              <li key={f.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-mono text-xs text-ink-gray-8" dir="ltr">{f.name}</span>
                <span className="flex items-center gap-3 text-xs text-ink-gray-5">
                  {f.kind === "before-restore" ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">{t(locale, "before a restore")}</span> : null}
                  {f.kind === "before-update" ? <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-800">{t(locale, "before an update")}</span> : null}
                  <span dir="ltr">{mb(f.size)}</span>
                  <a href={`/api/backup/file?name=${encodeURIComponent(f.name)}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                    <DownloadIcon size={13} />
                    {t(locale, "Download")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
