import "server-only";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { verifyLicense, type Jwk } from "./core";
import { codesServerEnabled } from "./env";
import type { DeviceState, Payload } from "./state";
import { secureCookies } from "@/lib/remote/request";

/**
 * The web version (Vercel) as its own codes server, where each BROWSER is a
 * device — the way spir-lab-manager's web version works. The first visit
 * shows the activation window; the code is checked right here against the
 * codes database, and the signed license is kept in a cookie on that
 * browser. Every few minutes the browser's seat is checked again, so a stop,
 * an expiry or a freed seat reaches it.
 *
 * On while the codes server is on (LICENSE_ADMIN_PASSWORD + its database);
 * off otherwise, so an unconfigured site never locks anyone out.
 */

export const DEVICE_COOKIE = "spir_device";
export const LICENSE_COOKIE = "spir_license";
const YEAR = 365 * 86_400_000;
const CHECK_MS = 5 * 60_000;

/** Web mode: on Vercel, or forced for tests with SPIR_WEB_LICENSE=1. */
export const webMode = () => !!process.env.VERCEL || process.env.SPIR_WEB_LICENSE === "1";

type Checked = { at: number; state: DeviceState; message: string };
type G = { __spirWebPub?: Jwk | null; __spirWebChecks?: Map<string, Checked> };
const g = globalThis as unknown as G;
const checks = () => (g.__spirWebChecks ??= new Map());

async function codes() {
  const { codesDb, sealSecret } = await import("./server");
  const { signingKeys } = await import("./core");
  const db = await codesDb();
  g.__spirWebPub ??= (await signingKeys(db.run, sealSecret())).pub;
  return { ...db, pub: g.__spirWebPub! };
}

function readCookie(name: string): string {
  try {
    return cookies().get(name)?.value ?? "";
  } catch {
    return ""; // outside a request
  }
}

function browserLabel(): string {
  let ua = "";
  try { ua = headers().get("user-agent") ?? ""; } catch { /* outside a request */ }
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [`متصفح${br ? ` ${br}` : ""}`, os].filter(Boolean).join(" · ").slice(0, 160);
}

const locked = (error: string, p?: Payload): DeviceState => ({
  kind: "locked",
  reason: error === "expired" ? "expired" : error === "stopped" ? "stopped" : "gone",
  company: p?.co,
  until: p?.until,
});

/** Where this browser stands. */
export async function webDeviceState(): Promise<DeviceState> {
  if (!codesServerEnabled()) return { kind: "off" };
  const device = readCookie(DEVICE_COOKIE);
  const token = readCookie(LICENSE_COOKIE);
  if (!device || !token) return { kind: "need" };
  const { licenses, pub } = await codes();
  const p = verifyLicense(token, pub) as Payload | null;
  if (!p || p.dev !== device) return { kind: "need" };
  const key = `${p.lid}|${device}`;
  const hit = checks().get(key);
  if (hit && Date.now() - hit.at < CHECK_MS) return hit.state;
  const res = await licenses.check(p.lid, device);
  const state: DeviceState = res.ok && res.row
    ? { kind: "ok", company: res.row.company, until: res.row.expires_at ?? p.until, mods: res.row.modules, seats: res.row.seats }
    : locked(res.ok ? "gone" : res.error, p);
  checks().set(key, { at: Date.now(), state, message: res.row?.message ?? "" });
  return state;
}

/** The provider's message for this browser's code, if any. */
export async function webMessage(): Promise<string> {
  const device = readCookie(DEVICE_COOKIE);
  for (const [k, v] of checks()) if (k.endsWith(`|${device}`) && v.state.kind === "ok") return v.message;
  return "";
}

export type WebActivateError = "not_found" | "seats_full" | "stopped" | "expired" | "disabled" | "error";

/** Enter the code on this browser (a server action: it sets the cookies). */
export async function webActivate(code: string, version: string): Promise<{ ok: true } | { ok: false; error: WebActivateError }> {
  if (!codesServerEnabled()) return { ok: false, error: "disabled" };
  try {
    const { licenses } = await codes();
    const device = readCookie(DEVICE_COOKIE) || randomUUID().replace(/-/g, "");
    const res = await licenses.activate(code, device, browserLabel(), version);
    if (!res.ok || !res.token) {
      const e = res.ok ? "error" : res.error;
      return { ok: false, error: (["not_found", "seats_full", "stopped", "expired"].includes(e) ? e : "error") as WebActivateError };
    }
    const opts = { httpOnly: true, sameSite: "lax" as const, secure: secureCookies(), path: "/", maxAge: YEAR / 1000 };
    cookies().set(DEVICE_COOKIE, device, opts);
    cookies().set(LICENSE_COOKIE, res.token, opts);
    for (const k of checks().keys()) if (k.endsWith(`|${device}`)) checks().delete(k);
    return { ok: true };
  } catch (e) {
    console.error("[license] web activation failed:", (e as Error).message);
    return { ok: false, error: "error" };
  }
}

/** "Check now": forget the last answer for this browser. */
export function webForget(): void {
  const device = readCookie(DEVICE_COOKIE);
  for (const k of checks().keys()) if (k.endsWith(`|${device}`)) checks().delete(k);
}
