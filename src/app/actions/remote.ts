"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/pglite";
import { applyGatewaySetting, gatewayState } from "@/lib/remote/gateway";
import { addBrowser, removeDevice, repairBrowser, revokeDevice } from "@/lib/remote/devices";
import { isRemoteRequest } from "@/lib/remote/request";

/**
 * Remote access (the Sync page): the gateway other devices reach the
 * program through, and the devices allowed in. Administrators only — and
 * only from this computer's own keyboard, so a paired device cannot open
 * the door wider or let in others.
 */

export interface RemoteState {
  error?: string;
  detail?: string;
  /** A pairing code to show once. */
  pairCode?: string;
  deviceName?: string;
}

async function requireLocalAdmin(): Promise<RemoteState | null> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return { error: "Only an admin can change this" };
  if (isRemoteRequest()) return { error: "Remote access is managed on the main computer itself." };
  return null;
}

function done(key: string): never {
  redirect(`/sync?done=${key}#remote`);
}

export async function setGatewayAction(_prev: RemoteState | null, formData: FormData): Promise<RemoteState> {
  const denied = await requireLocalAdmin();
  if (denied) return denied;
  const on = String(formData.get("enabled")) === "true";
  const port = Math.round(Number(formData.get("port") ?? 3300));
  if (!(port >= 1024 && port <= 65535)) return { error: "Choose a port between 1024 and 65535" };
  const appPort = Number(process.env.PORT || 3000);
  if (port === appPort || port === 3310) return { error: "That port is already used by the program. Choose another, such as 3300." };
  const requireDevice = formData.get("require_device") === "on";
  const { db } = await getDb();
  await db.query(`update _spir_gateway set enabled = $1, port = $2, require_device = $3, updated_at = now()`, [
    on, port, requireDevice,
  ]);
  await applyGatewaySetting();
  if (on && !gatewayState().running) {
    return { error: "Remote access could not start on that port.", detail: gatewayState().error ?? undefined };
  }
  done(on ? "remote-on" : "remote-off");
}

export async function addBrowserAction(_prev: RemoteState | null, formData: FormData): Promise<RemoteState> {
  const denied = await requireLocalAdmin();
  if (denied) return denied;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the device a name, such as the person's name or «office laptop»." };
  const { code } = await addBrowser(name);
  return { pairCode: code, deviceName: name };
}

export async function repairBrowserAction(_prev: RemoteState | null, formData: FormData): Promise<RemoteState> {
  const denied = await requireLocalAdmin();
  if (denied) return denied;
  const code = await repairBrowser(String(formData.get("id") ?? ""));
  if (!code) return { error: "That device was cut off. Add it again." };
  return { pairCode: code, deviceName: String(formData.get("name") ?? "") };
}

export async function revokeDeviceAction(formData: FormData): Promise<void> {
  if (await requireLocalAdmin()) return;
  await revokeDevice(String(formData.get("id") ?? ""));
  done("device-off");
}

export async function removeDeviceAction(formData: FormData): Promise<void> {
  if (await requireLocalAdmin()) return;
  await removeDevice(String(formData.get("id") ?? ""));
  done("device-removed");
}
