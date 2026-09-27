import "server-only";
import os from "node:os";
import { getDb } from "@/lib/db/pglite";
import { currentBuild } from "@/lib/version";
import { verifyLicense, hashCode, type Jwk, type DeviceSync } from "./core";
import { judge, isLocked, type DeviceState, type Payload } from "./state";
import { webMode, webDeviceState, webMessage, webActivate, webForget } from "./web";
import { signDoc, type DocFacts } from "./doc-verify";

/**
 * This computer's activation code — the device side.
 *
 * The program runs on the computer itself, so the license lives in the local
 * database (_spir_license, migration 0115) and is checked there, offline, on
 * every page: its ES256 signature against the codes server's public key, the
 * computer it was issued to, and its end date against the latest time this
 * computer has seen (turning the clock back does not extend it). When the
 * computer is online it asks the codes server — the web version — for a
 * fresh copy, at most every few hours: a renewal, a change of stations, a
 * stop, the company's database. A server that is down or slow changes
 * nothing; only a real refusal locks.
 */

/**
 * The codes server every build asks — the owner's web version on Vercel —
 * unless SPIR_LICENSE_SERVER says otherwise (set it to "" to switch codes
 * off, as the tests do). Until that site has LICENSE_ADMIN_PASSWORD and its
 * codes database, it answers that codes are off and nothing is locked.
 */
export const DEFAULT_LICENSE_SERVER = "https://spir-margin-three.vercel.app";

export function licenseServer(): string {
  // The web version is the codes server itself, not an installed computer.
  if (process.env.VERCEL) return "";
  const v = (process.env.SPIR_LICENSE_SERVER ?? DEFAULT_LICENSE_SERVER).trim().replace(/\/+$/, "");
  return /^https?:\/\/\S+$/.test(v) ? v : "";
}

const REFRESH_MS = 6 * 3600_000;
const ASK_ENABLED_MS = 6 * 3600_000;
const CACHE_MS = 20_000;
/** The answers after which the server really refuses this computer; anything else: try again later. */
const REFUSED = new Set(["not_found", "other_device", "stopped", "expired"]);

interface Row {
  device_id: string;
  token: string | null;
  pub: Jwk | null;
  checked_at: number | null;
  message: string;
  blocked: string | null;
  version: string;
  enabled: boolean | null;
  contact: string;
  seen_at: number;
  legacy: boolean;
  grace_start: number | null;
  sync_host: string;
  code_hash: string;
  verify_key: string;
}

type G = { __spirLicense?: { state: DeviceState; at: number } | null; __spirLicenseAsked?: number };
const g = globalThis as unknown as G;

async function readRow(): Promise<Row> {
  const { db } = await getDb();
  let r = (await db.query(`select * from _spir_license`)).rows[0] as Record<string, unknown> | undefined;
  if (!r) {
    await db.query(`insert into _spir_license (only_row) values (true) on conflict do nothing`);
    r = (await db.query(`select * from _spir_license`)).rows[0] as Record<string, unknown>;
  }
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    device_id: String(r.device_id),
    token: (r.token as string) ?? null,
    pub: (typeof r.pub === "string" ? JSON.parse(r.pub) : r.pub) as Jwk | null,
    checked_at: num(r.checked_at),
    message: String(r.message ?? ""),
    blocked: (r.blocked as string) ?? null,
    version: String(r.version ?? ""),
    enabled: r.enabled == null ? null : r.enabled === true || r.enabled === "t",
    contact: String(r.contact ?? ""),
    seen_at: Number(r.seen_at ?? 0),
    legacy: r.legacy === true || r.legacy === "t",
    grace_start: num(r.grace_start),
    sync_host: String(r.sync_host ?? ""),
    code_hash: String(r.code_hash ?? ""),
    verify_key: String(r.verify_key ?? ""),
  };
}

async function write(set: Record<string, unknown>): Promise<void> {
  const { db } = await getDb();
  const keys = Object.keys(set);
  await db.query(
    `update _spir_license set ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")}, updated_at = now()`,
    keys.map((k) => (k === "pub" && set[k] != null ? JSON.stringify(set[k]) : set[k])),
  );
  g.__spirLicense = null;
}

export const appVersion = () => {
  const b = currentBuild();
  return b ? `build-${b.number}` : "";
};

function deviceLabel(): string {
  const osName = { win32: "Windows", darwin: "Mac", linux: "Linux" }[process.platform as string] ?? process.platform;
  return `${os.hostname()} · ${osName}`.slice(0, 160);
}

const payloadOf = (r: Row): Payload | null => (r.token && r.pub ? (verifyLicense(r.token, r.pub) as Payload | null) : null);

/** Where this computer stands (cached for a few seconds: every page asks). */
export async function deviceState(): Promise<DeviceState> {
  if (webMode()) return webDeviceState();
  if (!licenseServer()) return { kind: "off" };
  const c = g.__spirLicense;
  if (c && Date.now() - c.at < CACHE_MS) return c.state;
  const r = await readRow();
  const now = Date.now();
  // The latest time seen only moves forward, so the clock turned back is noticed.
  if (now > r.seen_at + 60_000) await write({ seen_at: now });
  const payload = payloadOf(r);
  let graceStart = r.grace_start;
  if (r.legacy && !payload && graceStart == null && r.enabled !== false) {
    graceStart = now;
    await write({ grace_start: now });
  }
  const state = judge({
    hasServer: true, enabled: r.enabled, payload, deviceId: r.device_id, blocked: r.blocked,
    now, seen: r.seen_at, legacy: r.legacy, graceStart,
  });
  g.__spirLicense = { state, at: Date.now() };
  return state;
}

/** The data layer's question: is this computer closed until a code is entered? */
export async function deviceLocked(): Promise<boolean> {
  try {
    return isLocked(await deviceState());
  } catch {
    return false; // a failure to read the license never locks anyone out
  }
}

/** What the welcome page and the notices show alongside the state. */
export async function deviceInfo(): Promise<{ message: string; contact: string; version: string; server: string }> {
  if (webMode()) {
    const { getContact } = await import("./server");
    return { message: await webMessage(), contact: await getContact().catch(() => ""), version: appVersion(), server: "" };
  }
  if (!licenseServer()) return { message: "", contact: "", version: appVersion(), server: "" };
  const r = await readRow();
  return { message: r.blocked ? "" : r.message, contact: r.contact, version: appVersion(), server: licenseServer() };
}

async function call(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(`${licenseServer()}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

/** Ask whether codes are on (remembered for offline starts). A server that does not answer changes nothing. */
export async function fetchEnabled(timeoutMs = 8_000): Promise<void> {
  if (!licenseServer()) return;
  try {
    const { status, body } = await call("/api/license", undefined, timeoutMs);
    if (!body || typeof body.enabled !== "boolean") {
      // It answered, but not as a codes server (a password-protected or older
      // deployment, a wrong address): codes stay off rather than lock every
      // computer. A server error changes nothing; the next ask decides again.
      if (status < 500) await write({ enabled: false });
      return;
    }
    await write({ enabled: body.enabled, contact: typeof body.contact === "string" ? body.contact.slice(0, 300) : "" });
  } catch { /* offline — the last answer stands */ }
  g.__spirLicenseAsked = Date.now();
}

/** Called with every signed license: keep it, and hand the company's database (if any) to sync. */
async function store(d: Record<string, unknown>): Promise<void> {
  await write({
    token: String(d.token), pub: d.pub, checked_at: Date.now(), message: typeof d.message === "string" ? d.message.slice(0, 300) : "",
    blocked: null, version: appVersion(), enabled: true,
    ...(typeof d.vkey === "string" && d.vkey ? { verify_key: d.vkey } : {}),
    // The server's clock resets a computer whose clock was set wrongly forward.
    ...(typeof d.now === "number" ? { seen_at: d.now } : {}),
  });
  const { applyCompanyDatabase } = await import("./company-db");
  await applyCompanyDatabase((d.sync as DeviceSync | null) ?? null).catch((e) =>
    console.error("[license] could not apply the company's database:", (e as Error).message));
}

export type ActivateError = "not_found" | "seats_full" | "stopped" | "expired" | "too_many" | "offline" | "bad_request" | "disabled" | "error";

/** Enter the company's code on this computer (also used to renew with a new code). */
export async function activateCode(code: string): Promise<{ ok: true } | { ok: false; error: ActivateError }> {
  if (webMode()) return webActivate(code, appVersion());
  if (!licenseServer()) return { ok: false, error: "disabled" };
  const r = await readRow();
  try {
    const { body } = await call("/api/license/activate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, device: r.device_id, label: deviceLabel(), version: appVersion() }),
    });
    if (body?.ok) {
      await store(body);
      // A fingerprint of the code (never the code): it also opens the whole system here, offline.
      await write({ code_hash: hashCode(code) });
      return { ok: true };
    }
    const e = String(body?.error ?? "error");
    return { ok: false, error: (["not_found", "seats_full", "stopped", "expired", "too_many", "bad_request", "disabled"].includes(e) ? e : "error") as ActivateError };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/**
 * Refresh from the server when online: at most every few hours unless forced,
 * and at once after an update so the owner sees the new version.
 */
export async function refreshLicense(force = false): Promise<void> {
  if (!licenseServer()) return;
  const r = await readRow();
  if (!r.token) return;
  const p = payloadOf(r);
  if (!p) return;
  if (!force && r.checked_at && Date.now() - r.checked_at < REFRESH_MS && r.version === appVersion()) return;
  try {
    const { status, body } = await call("/api/license/check", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lid: p.lid, device: r.device_id, version: appVersion(), syncHost: await ownDatabaseHost(), sync: await syncReport() }),
    });
    if (!body) return;
    if (body.ok === true && typeof body.token === "string" && body.pub) await store(body);
    else if ((status === 403 || status === 404) && REFUSED.has(String(body.error))) {
      await write({ blocked: String(body.error), checked_at: Date.now() });
    }
  } catch { /* offline — try again next time */ }
}

/** How this computer's sync stands, for the owner's list: never an address or a record. */
async function syncReport(): Promise<{ kind: string; at: number | null; pending: number; error: string } | null> {
  try {
    const { syncStatus } = await import("@/lib/sync/engine");
    const s = await syncStatus();
    const at = s.lastSyncAt ? Date.parse(s.lastSyncAt) : NaN;
    return { kind: s.kind ?? "none", at: Number.isFinite(at) ? at : null, pending: s.pending, error: (s.lastError ?? "").slice(0, 200) };
  } catch {
    return null;
  }
}

/** The host of a hosted database this computer linked on its own (reported to the owner, never the address). */
async function ownDatabaseHost(): Promise<string | null> {
  try {
    const { ownLinkedHost } = await import("./company-db");
    return await ownLinkedHost();
  } catch {
    return null;
  }
}

/** Background: ask whether codes are on a few times a day, refresh the license when due. */
export async function licenseTick(): Promise<void> {
  if (!licenseServer()) return;
  if (!g.__spirLicenseAsked || Date.now() - g.__spirLicenseAsked > ASK_ENABLED_MS) await fetchEnabled();
  await refreshLicense(false);
}

/**
 * The company's activation code as the key to the whole system on this
 * computer (signed in as the administrator, who then gives staff accounts of
 * their own). Checked offline against the fingerprint kept at activation; a
 * code this computer has not seen yet — a new code from the provider, or a
 * computer activated before fingerprints were kept — is checked with the
 * codes server, which also brings the license up to date.
 */
export async function codeOpensThisComputer(code: string): Promise<boolean> {
  if (!code.trim()) return false;
  if (webMode()) return (await deviceState()).kind === "ok" && (await webActivate(code, appVersion())).ok;
  if (!licenseServer()) return false;
  if ((await deviceState()).kind !== "ok") return false;
  const r = await readRow();
  if (r.code_hash && r.code_hash === hashCode(code)) return true;
  const res = await activateCode(code);
  return res.ok && (await deviceState()).kind === "ok";
}

/**
 * The address a printed document's QR points to: its facts signed with this
 * code's verify key, checked on the codes server's /verify page. Null when
 * there is no key yet (codes off, or a license from before keys existed —
 * the next check brings one).
 */
export async function docVerifyUrl(facts: DocFacts): Promise<string | null> {
  try {
    if (webMode()) {
      const { webVerifyKey } = await import("./web");
      const k = await webVerifyKey();
      if (!k) return null;
      return `${k.base}/verify/${signDoc(k.lid, k.key, facts)}`;
    }
    const server = licenseServer();
    if (!server) return null;
    const r = await readRow();
    const p = payloadOf(r);
    if (!p || !r.verify_key) return null;
    return `${server}/verify/${signDoc(p.lid, r.verify_key, facts)}`;
  } catch {
    return null;
  }
}

/** "Check now" on the lock screen and the welcome page: ask again at once. */
export async function recheck(): Promise<DeviceState> {
  if (webMode()) { webForget(); return deviceState(); }
  await fetchEnabled();
  await refreshLicense(true);
  g.__spirLicense = null;
  return deviceState();
}
