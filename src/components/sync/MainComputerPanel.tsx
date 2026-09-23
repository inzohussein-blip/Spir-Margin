"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon, PowerIcon, RefreshCwIcon } from "lucide-react";
import { setMainComputerAction, newMainCodeAction, type LinkState } from "@/app/actions/links";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { Result } from "./Result";
import { ShowCode } from "./ShowCode";

export interface OfficeClient {
  name: string | null;
  address: string | null;
  lastSeen: string;
}

function Toggle({ on }: { on: boolean }) {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
        on ? "border border-outline-gray-2 text-ink-gray-7 hover:border-red-300 hover:text-red-700" : "bg-brand text-white hover:bg-brand-dark"
      }`}
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <PowerIcon size={15} />}
      {on ? t(locale, "Stop serving the office network") : t(locale, "Make this the main computer")}
    </button>
  );
}

export function MainComputerPanel({
  enabled,
  running,
  error,
  port,
  addresses,
  clients,
}: {
  enabled: boolean;
  running: boolean;
  error: string | null;
  port: number;
  addresses: string[];
  clients: OfficeClient[];
}) {
  const locale = useLocale();
  const [state, action] = useFormState(setMainComputerAction, null as LinkState | null);
  const [codeState, regenerate] = useFormState(async () => newMainCodeAction(), null as LinkState | null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-gray-6">
        {t(locale, "One computer in the office keeps everyone in step: the others link to it with its code, over the office network, with no internet needed. If it is also linked to the hosted database, it passes the office's work on to the branches.")}
      </p>

      <form action={action}>
        <input type="hidden" name="enabled" value={String(!enabled)} />
        <Toggle on={enabled} />
      </form>
      <Result state={state ?? codeState} />

      {enabled ? (
        <div className="space-y-4 rounded-lg border border-outline-gray-2 p-4">
          {running ? (
            <p className="text-sm text-emerald-700">
              {t(locale, "Serving the office network on port")} <span dir="ltr" className="font-mono">{port}</span>
              {" — "}
              <span dir="ltr" className="font-mono text-xs text-ink-gray-6">{addresses.join(" · ")}</span>
            </p>
          ) : (
            <p role="alert" className="text-sm text-red-700">
              {t(locale, "The office-network service is not running.")}{" "}
              {error ? <span dir="ltr" className="font-mono text-xs">{error}</span> : null}
            </p>
          )}

          <ShowCode which="lan" />

          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t(locale, "The first time, Windows may ask whether to allow Node.js on the network. Choose Allow, for private networks — otherwise the other computers cannot reach this one.")}
          </p>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-gray-8">{t(locale, "Computers that have synced with this one")}</h3>
            {clients.length === 0 ? (
              <p className="text-sm text-ink-gray-5">{t(locale, "None yet.")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-gray-5">
                  <tr>
                    <th className="py-1 text-start font-medium">{t(locale, "Computer")}</th>
                    <th className="py-1 text-start font-medium">{t(locale, "Address")}</th>
                    <th className="py-1 text-start font-medium">{t(locale, "Last synced")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-gray-1">
                  {clients.map((c, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-medium" dir="auto">{c.name ?? "—"}</td>
                      <td className="py-1.5 font-mono text-xs" dir="ltr">{c.address?.replace(/^::ffff:/, "") ?? "—"}</td>
                      <td className="py-1.5 text-ink-gray-6" dir="ltr">{c.lastSeen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form action={regenerate}>
            <ConfirmSubmit
              confirmText={t(locale, "Make a new code? Every computer linked with the current one will stop syncing until it is linked again.")}
              className="inline-flex items-center gap-1.5 text-xs text-ink-gray-6 hover:text-red-700"
            >
              <RefreshCwIcon size={13} />
              {t(locale, "Make a new code (if the current one may have leaked)")}
            </ConfirmSubmit>
          </form>
        </div>
      ) : null}
    </div>
  );
}
