"use server";

import { revalidatePath } from "next/cache";
import { activateCode, recheck } from "@/lib/license/device";

/**
 * The activation window on the welcome page. No session is needed — the
 * computer is closed until a code is entered — and nothing here reads or
 * changes business data: it only passes the code to the codes server, which
 * limits wrong tries per address.
 */

export interface ActivateState { ok?: boolean; error?: string }

const ERRORS: Record<string, string> = {
  not_found: "The code is not right.",
  seats_full: "This code is already in use on all the computers it allows. Ask the provider for another seat.",
  stopped: "This code is stopped. Contact the provider.",
  expired: "This code's period is over. Contact the provider to renew it.",
  too_many: "Too many attempts — wait a few minutes.",
  offline: "No internet connection. Entering the code needs the internet once.",
  bad_request: "Type the code in full, as you received it.",
  disabled: "Activation codes are not switched on.",
};

export async function activateLicenseAction(_prev: ActivateState | null, fd: FormData): Promise<ActivateState> {
  const code = String(fd.get("code") ?? "").trim();
  if (code.replace(/[^0-9A-Za-z]/g, "").length < 8) return { error: ERRORS.bad_request };
  const r = await activateCode(code);
  if (!r.ok) return { error: ERRORS[r.error] ?? "Could not activate — try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function recheckLicenseAction(): Promise<{ kind: string }> {
  const s = await recheck();
  revalidatePath("/", "layout");
  return { kind: s.kind };
}
