"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon, PowerIcon, PlusIcon, KeyRoundIcon, BanIcon, Trash2Icon, SaveIcon, AlertTriangleIcon } from "lucide-react";
import {
  addBrowserAction, removeDeviceAction, repairBrowserAction, revokeDeviceAction, setGatewayAction, type RemoteState,
} from "@/app/actions/remote";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export interface RemoteDeviceView {
  id: string;
  name: string;
  kind: "browser" | "computer";
  status: "waiting" | "expired" | "active" | "revoked";
  pairUntil: string | null;
  lastSeen: string | null;
  lastAddress: string | null;
}

export interface RemoteAccessView {
  enabled: boolean;
  running: boolean;
  error: string | null;
  port: number;
  requireDevice: boolean;
  urls: { url: string; kind: "tailscale" | "lan" | "name" }[];
  devices: RemoteDeviceView[];
  /** Managing all this is for the main computer's own keyboard. */
  remote: boolean;
}

function Submit({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
        primary ? "bg-brand text-white hover:bg-brand-dark" : "border border-outline-gray-2 text-ink-gray-7 hover:border-brand hover:text-brand"
      }`}
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function Problem({ state }: { state: RemoteState | null }) {
  const locale = useLocale();
  if (!state?.error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
      <span>
        {t(locale, state.error)}
        {state.detail ? <code dir="ltr" className="mt-1 block text-xs">{state.detail}</code> : null}
      </span>
    </p>
  );
}

function PairCode({ state }: { state: RemoteState | null }) {
  const locale = useLocale();
  if (!state?.pairCode) return null;
  return (
    <div role="status" className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm">
      <p className="text-ink-gray-7">
        {t(locale, "On the device")} «{state.deviceName}», {t(locale, "open one of the addresses above and type this code. It works once, within 15 minutes.")}
      </p>
      <p data-pair-code className="mt-2 text-center font-mono text-3xl font-bold tracking-widest text-ink-gray-9" dir="ltr">
        {state.pairCode}
      </p>
    </div>
  );
}

const STATUS: Record<RemoteDeviceView["status"], { label: string; cls: string }> = {
  waiting: { label: "Waiting for its code", cls: "bg-amber-50 text-amber-800" },
  expired: { label: "Code expired", cls: "bg-surface-gray-2 text-ink-gray-6" },
  active: { label: "Allowed", cls: "bg-emerald-50 text-emerald-700" },
  revoked: { label: "Cut off", cls: "bg-red-50 text-red-700" },
};

export function RemoteAccessPanel({ v }: { v: RemoteAccessView }) {
  const locale = useLocale();
  const [gwState, gwAction] = useFormState(setGatewayAction, null as RemoteState | null);
  const [addState, addAction] = useFormState(addBrowserAction, null as RemoteState | null);
  const [repairState, repairAction] = useFormState(repairBrowserAction, null as RemoteState | null);

  if (v.remote) {
    return <p className="text-sm text-ink-gray-6">{t(locale, "Remote access is managed on the main computer itself.")}</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-gray-6">
        {t(locale, "Let the company's other devices — a laptop, another office's computer, a phone — open the program on this computer from their browser, each with its own account. Over the office network, or over the internet through a private network such as Tailscale (see the instructions).")}
      </p>

      {v.enabled ? (
        v.running ? (
          <p className="text-sm font-medium text-emerald-700" data-testid="gateway-on">
            {t(locale, "Remote access is on, on port")} <span dir="ltr" className="font-mono">{v.port}</span>.
          </p>
        ) : (
          <p role="alert" className="text-sm text-red-700">
            {t(locale, "Remote access is on, but not running.")} {v.error ? <code dir="ltr" className="text-xs">{v.error}</code> : null}
          </p>
        )
      ) : (
        <p className="text-sm text-ink-gray-7">{t(locale, "Remote access is off: the program opens on this computer only.")}</p>
      )}

      <form action={gwAction} className="grid grid-cols-1 gap-3 rounded-lg border border-outline-gray-2 p-4 sm:grid-cols-2">
        <input type="hidden" name="enabled" value="true" />
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">{t(locale, "Port")}</span>
          <input name="port" type="number" min={1024} max={65535} defaultValue={v.port} dir="ltr" className={cls} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="require_device" defaultChecked={v.requireDevice} className="size-4 accent-[var(--brand,#4f46e5)]" />
          <span className="text-ink-gray-8">{t(locale, "Only paired devices (recommended)")}</span>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Submit primary>
            {v.enabled ? <SaveIcon size={15} /> : <PowerIcon size={15} />}
            {v.enabled ? t(locale, "Save") : t(locale, "Turn on remote access")}
          </Submit>
        </div>
      </form>
      {v.enabled ? (
        <form action={gwAction}>
          <input type="hidden" name="enabled" value="false" />
          <input type="hidden" name="port" value={v.port} />
          {v.requireDevice ? <input type="hidden" name="require_device" value="on" /> : null}
          <Submit>
            <PowerIcon size={15} /> {t(locale, "Turn off remote access")}
          </Submit>
        </form>
      ) : null}
      <Problem state={gwState} />

      {v.enabled && !v.requireDevice ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t(locale, "Anyone who can reach this port sees the sign-in page. Keep it to a trusted network, and give every account a strong password.")}
        </p>
      ) : null}

      {v.enabled ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-gray-8">{t(locale, "Addresses to open on the other devices")}</h3>
          <ul className="space-y-1 text-sm" data-testid="gateway-urls">
            {v.urls.map((u) => (
              <li key={u.url} className="flex flex-wrap items-center gap-2">
                <code dir="ltr" className="rounded bg-surface-gray-1 px-2 py-0.5 text-xs">{u.url}</code>
                <span className="text-xs text-ink-gray-5">
                  {t(locale, u.kind === "tailscale" ? "over the internet, through Tailscale" : u.kind === "lan" ? "office network" : "office network, by the computer's name")}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-gray-5">
            {t(locale, "The built-in account works only on this computer. Give each person an account of their own under Users.")}
          </p>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t(locale, "The first time, Windows may ask whether to allow Node.js on the network. Choose Allow, for private networks — otherwise the other computers cannot reach this one.")}
          </p>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-outline-gray-1 pt-4">
        <h3 className="text-sm font-semibold text-ink-gray-8">{t(locale, "Devices allowed in")}</h3>

        {v.enabled && v.requireDevice ? (
          <form action={addAction} className="flex flex-wrap items-end gap-2">
            <label className="block min-w-60 flex-1 text-sm">
              <span className="font-medium text-ink-gray-8">{t(locale, "New device")}</span>
              <input name="name" placeholder={t(locale, "e.g. Ahmed's laptop")} maxLength={120} className={cls} />
            </label>
            <Submit primary>
              <PlusIcon size={15} /> {t(locale, "Add a device")}
            </Submit>
          </form>
        ) : null}
        <Problem state={addState ?? repairState} />
        <PairCode state={addState?.pairCode ? addState : repairState} />

        {v.devices.length === 0 ? (
          <p className="text-sm text-ink-gray-5">{t(locale, "None yet.")}</p>
        ) : (
          <table className="w-full text-sm" data-testid="devices">
            <thead className="text-xs text-ink-gray-5">
              <tr>
                <th className="py-1 text-start font-medium">{t(locale, "Device")}</th>
                <th className="py-1 text-start font-medium">{t(locale, "Kind")}</th>
                <th className="py-1 text-start font-medium">{t(locale, "State")}</th>
                <th className="py-1 text-start font-medium">{t(locale, "Last seen")}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {v.devices.map((d) => (
                <tr key={d.id} data-device={d.name}>
                  <td className="py-1.5 font-medium" dir="auto">{d.name}</td>
                  <td className="py-1.5 text-ink-gray-6">{t(locale, d.kind === "browser" ? "Browser" : "Computer (full copy)")}</td>
                  <td className="py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS[d.status].cls}`}>{t(locale, STATUS[d.status].label)}</span>
                  </td>
                  <td className="py-1.5 text-xs text-ink-gray-6">
                    <span dir="ltr">{d.lastSeen ?? "—"}</span>
                    {d.lastAddress ? <code dir="ltr" className="ms-1 text-[11px] text-ink-gray-5">{d.lastAddress}</code> : null}
                  </td>
                  <td className="py-1.5 text-end">
                    <div className="flex justify-end gap-1">
                      {d.kind === "browser" && d.status !== "revoked" && v.enabled && v.requireDevice ? (
                        <form action={repairAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="name" value={d.name} />
                          <button type="submit" title={t(locale, "New pairing code")} className="rounded p-1 text-ink-gray-5 hover:text-brand">
                            <KeyRoundIcon size={15} />
                          </button>
                        </form>
                      ) : null}
                      {d.status !== "revoked" ? (
                        <form action={revokeDeviceAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <ConfirmSubmit
                            confirmText={t(locale, "Cut this device off? It stops working at once; the others are not affected.")}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            <BanIcon size={12} /> {t(locale, "Cut off")}
                          </ConfirmSubmit>
                        </form>
                      ) : (
                        <form action={removeDeviceAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" title={t(locale, "Remove from the list")} className="rounded p-1 text-ink-gray-5 hover:text-red-600">
                            <Trash2Icon size={15} />
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
