"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon, RefreshCwIcon, DownloadCloudIcon, SaveIcon, CheckCircle2Icon, AlertTriangleIcon } from "lucide-react";
import {
  checkUpdatesAction, installUpdateAction, saveUpdateSettingsAction, type UpdateActionState,
} from "@/app/actions/updates";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export interface UpdatesView {
  kind: "web" | "windows" | "manual";
  current: { number: number; date: string | null } | null;
  latest: { number: number; date: string | null } | null;
  available: boolean;
  checkedAt: string | null;
  checkError: string | null;
  running: boolean;
  /** The last update's outcome, when there is one worth showing. */
  outcome: { state: string; number: number; detail: string } | null;
  auto: boolean;
  atTime: string;
}

const STEP: Record<string, string> = {
  checking: "Looking for the newest release…",
  downloading: "Downloading the new release…",
  building: "Preparing the new release. The program keeps working meanwhile — this takes a few minutes.",
  switching: "Switching to the new release. The program stops for a moment.",
  starting: "Starting the new release…",
};

function Save() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md border border-outline-gray-2 px-4 py-2 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <SaveIcon size={15} />}
      {t(locale, "Save")}
    </button>
  );
}

/**
 * Follows an update while it runs. The program restarts half-way, so
 * failed requests are expected: keep asking, and reload once it is over.
 */
function Progress({ initial }: { initial: string }) {
  const locale = useLocale();
  const [state, setState] = useState(initial);
  const [down, setDown] = useState(false);
  const reloaded = useRef(false);
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const r = await fetch("/api/update/status", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const s = (await r.json()) as { state: string | null; running: boolean };
        setDown(false);
        if (s.state) setState(s.state);
        if (!s.running && !reloaded.current) {
          reloaded.current = true;
          window.location.reload();
        }
      } catch {
        setDown(true);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div role="status" data-update-progress={state} className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
      <Loader2Icon size={16} className="mt-0.5 shrink-0 animate-spin" />
      <span>
        {t(locale, STEP[state] ?? STEP.checking)}
        {down ? <span className="mt-1 block text-xs">{t(locale, "The program is restarting; this page will come back by itself.")}</span> : null}
      </span>
    </div>
  );
}

export function UpdatesPanel({ v }: { v: UpdatesView }) {
  const locale = useLocale();
  const [saveState, saveAction] = useFormState(saveUpdateSettingsAction, null as UpdateActionState | null);
  const [actState, setActState] = useState<UpdateActionState | null>(null);
  const [busy, start] = useTransition();
  const err = saveState ?? actState;
  const release = (r: { number: number; date: string | null }) =>
    `${t(locale, "Release")} ${r.number}${r.date ? ` (${r.date})` : ""}`;

  if (v.kind === "web") {
    return (
      <div className="space-y-2 p-5 text-sm text-ink-gray-7">
        <p>{t(locale, "The web copy updates itself: every change merged into the main branch is published automatically within minutes.")}</p>
        {v.current ? <p data-testid="current-release">{t(locale, "This copy")}: {release(v.current)}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-4 py-3 text-sm">
        <p data-testid="current-release" className="text-ink-gray-8">
          {t(locale, "This computer")}: {v.current ? release(v.current) : t(locale, "a copy installed before numbered releases")}
        </p>
        {v.checkError ? (
          <p className="flex items-start gap-2 text-amber-800">
            <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
            <span>
              {t(locale, "Could not reach the update server. Check the internet connection; the program works as usual meanwhile.")}{" "}
              <code dir="ltr" className="text-xs">{v.checkError}</code>
            </span>
          </p>
        ) : v.available && v.latest ? (
          <p data-testid="update-available" className="font-semibold text-brand">
            {t(locale, "A new release is available")}: {release(v.latest)}
          </p>
        ) : v.checkedAt ? (
          <p data-testid="up-to-date" className="flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2Icon size={15} /> {t(locale, "This is the newest release.")}
          </p>
        ) : (
          <p className="text-ink-gray-5">{t(locale, "Not checked yet.")}</p>
        )}
        {v.checkedAt ? <p className="text-xs text-ink-gray-5">{t(locale, "Last checked")}: <span dir="ltr">{v.checkedAt}</span></p> : null}
      </div>

      {v.running ? <Progress initial={v.outcome?.state ?? "checking"} /> : null}

      {!v.running && v.outcome?.state === "done" ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t(locale, "The last update finished")}: {t(locale, "Release")} {v.outcome.number}.
        </p>
      ) : null}
      {!v.running && (v.outcome?.state === "failed" || v.outcome?.state === "rolledback") ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t(locale, v.outcome.state === "failed"
            ? "The last update did not complete; the program kept working as it was."
            : "The last update did not start on this computer, so the previous release and its data were put back.")}
          {v.outcome.detail ? <code dir="ltr" className="mt-1 block text-xs">{v.outcome.detail}</code> : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || v.running}
          onClick={() => start(async () => setActState((await checkUpdatesAction()) ?? null))}
          className="inline-flex items-center gap-2 rounded-md border border-outline-gray-2 px-4 py-2 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {busy ? <Loader2Icon size={15} className="animate-spin" /> : <RefreshCwIcon size={15} />}
          {t(locale, "Check now")}
        </button>
        {v.kind === "windows" && v.available && !v.running ? (
          <form action={async () => setActState((await installUpdateAction()) ?? null)}>
            <ConfirmSubmit
              confirmText={t(locale, "Install the new release now? A backup is taken first, and the program stops for about a minute near the end.")}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <DownloadCloudIcon size={15} /> {t(locale, "Update now")}
            </ConfirmSubmit>
          </form>
        ) : null}
      </div>

      {v.kind === "manual" ? (
        <p className="text-sm text-ink-gray-6">
          {t(locale, "To update this computer, download the newest release and run the installer with the update option — the steps are in the instructions.")}
        </p>
      ) : (
        <form action={saveAction} className="grid grid-cols-1 gap-3 border-t border-outline-gray-1 pt-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="auto" defaultChecked={v.auto} className="size-4 accent-[var(--brand,#4f46e5)]" />
            <span className="font-medium text-ink-gray-8">{t(locale, "Install new releases automatically")}</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink-gray-8">{t(locale, "At")}</span>
            <input name="at_time" type="time" defaultValue={v.atTime} dir="ltr" lang="en-GB" className={cls} />
          </label>
          <div className="flex items-end"><Save /></div>
          <p className="text-xs text-ink-gray-5 sm:col-span-2">
            {t(locale, "At that time each day, or when the computer is next switched on after it. Choose an hour when nobody is working.")}
          </p>
        </form>
      )}

      {err?.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(locale, err.error)}
          {err.detail ? <code dir="ltr" className="mt-1 block text-xs">{err.detail}</code> : null}
        </p>
      ) : null}
    </div>
  );
}
