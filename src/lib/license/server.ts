import "server-only";
import { getDb } from "@/lib/db/pglite";
import { Licenses, ensureTables, getConfig, setConfig, sealText, unsealText, type Runner, type Sealed } from "./core";
import { cleanStations, STATIONS } from "./modules";
import { newTotpSecret, totpMatch, totpUri } from "./totp";
import { licenseDbUrl, licenseStorage } from "./env";

export { codesServerEnabled, ownerPasswordSet, durableStorage, licenseStorage } from "./env";

/**
 * The codes server, wired to its database and secret. Runs on the web version
 * (Vercel) — or on any install where LICENSE_ADMIN_PASSWORD is set, which is
 * how the tests run it. The logic itself is in core.ts.
 */

// The URL's own sslmode is dropped: TLS is set here, always verified.
function withoutSslMode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    return u.toString();
  } catch {
    return url;
  }
}

type G = { __spirCodesPool?: Promise<Runner>; __spirCodesReady?: Promise<void> | null };
const g = globalThis as unknown as G;

async function runner(): Promise<Runner> {
  const url = licenseDbUrl();
  if (url) {
    g.__spirCodesPool ??= import("pg").then(({ Pool }) => new Pool({
      connectionString: withoutSslMode(url),
      max: Number(process.env.LICENSE_PGPOOL_MAX || 3),
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
    }) as unknown as Runner);
    return g.__spirCodesPool;
  }
  return (await getDb()).db as unknown as Runner;
}

/** The secret that seals the signing key and each company's database link. */
export function sealSecret(): string {
  const s = (process.env.AUTH_SECRET ?? "").trim();
  if (s) return s;
  // A local trial of the codes server works without one; the web version never does.
  return process.env.VERCEL ? "" : "spir-margin-local-codes-secret";
}

export async function codesDb(): Promise<{ run: Runner; licenses: Licenses }> {
  const run = await runner();
  g.__spirCodesReady ??= ensureTables(run).catch((e) => { g.__spirCodesReady = null; throw e; });
  await g.__spirCodesReady;
  return { run, licenses: new Licenses(run, sealSecret(), cleanStations, STATIONS.map((s) => s.id)) };
}

// ── Contact line (activation and lock screens) ──────────────────────────────
export async function getContact(): Promise<string> {
  const { run } = await codesDb();
  const saved = ((await getConfig(run, "contact").catch(() => null)) ?? "").trim();
  return saved || (process.env.SPIR_ACTIVATION_CONTACT ?? "").trim();
}
export async function setContact(v: string): Promise<void> {
  const { run } = await codesDb();
  await setConfig(run, "contact", v.trim().slice(0, 300));
}

// ── Storage check for the owner ──────────────────────────────────────────────
export async function storageStatus(write = false): Promise<{ source: string; ok: boolean; codes?: number; roundTripMs?: number; error?: string; sealed: boolean }> {
  const source = licenseStorage();
  const sealed = !!(process.env.AUTH_SECRET ?? "").trim();
  try {
    const { run } = await codesDb();
    const r = await run.query<{ n: string | number }>(`select count(*) as n from _spir_lic`);
    const n = Number(r.rows[0]?.n ?? 0);
    if (!write) return { source, ok: true, codes: n, sealed };
    const t0 = Date.now(), stamp = String(t0);
    await setConfig(run, "selftest", stamp);
    const back = await getConfig(run, "selftest");
    await run.query(`delete from _spir_lic_config where key = 'selftest'`);
    return back === stamp ? { source, ok: true, codes: n, roundTripMs: Date.now() - t0, sealed } : { source, ok: false, codes: n, error: "readback", sealed };
  } catch (e) {
    return { source, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "error", sealed };
  }
}

// ── Two-step sign-in for the owner (authenticator app) ──────────────────────
// The shared secret is sealed with AUTH_SECRET like the signing key.
// LICENSE_2FA_OFF=1 in the environment switches the second step off (a lost phone).
const TOTP_AAD = "spir-owner-totp";
export const twoFactorForcedOff = () => process.env.LICENSE_2FA_OFF === "1";

async function readTotp(key: "owner_totp" | "owner_totp_pending"): Promise<string | null> {
  const { run } = await codesDb();
  const raw = await getConfig(run, key).catch(() => null);
  const secret = sealSecret();
  if (!raw || !secret) return null;
  try { return unsealText(JSON.parse(raw) as Sealed, secret, TOTP_AAD); } catch { return null; }
}

export async function twoFactorStatus(): Promise<{ enabled: boolean; broken: boolean; forcedOff: boolean; canSetup: boolean }> {
  const { run } = await codesDb();
  const stored = !!(await getConfig(run, "owner_totp").catch(() => null));
  const enabled = stored && (await readTotp("owner_totp")) != null;
  return { enabled, broken: stored && !enabled, forcedOff: twoFactorForcedOff(), canSetup: !!sealSecret() };
}
export async function twoFactorRequired(): Promise<boolean> {
  return !twoFactorForcedOff() && (await readTotp("owner_totp")) != null;
}
/** A code counts once: a step already used, or older, is refused. */
async function consumeCode(secret: string, code: string): Promise<boolean> {
  const { run } = await codesDb();
  const step = totpMatch(secret, code);
  if (step == null) return false;
  const last = Number((await getConfig(run, "owner_totp_last")) ?? 0);
  if (step <= last) return false;
  await setConfig(run, "owner_totp_last", String(step));
  return true;
}
export async function checkOwnerCode(code: string): Promise<boolean> {
  const secret = await readTotp("owner_totp");
  return !!secret && (await consumeCode(secret, code));
}
export async function startTwoFactorSetup(): Promise<{ secret: string; uri: string } | null> {
  const key = sealSecret();
  if (!key) return null;
  const { run } = await codesDb();
  const secret = newTotpSecret();
  await setConfig(run, "owner_totp_pending", JSON.stringify(sealText(secret, key, TOTP_AAD)));
  return { secret, uri: totpUri(secret, "owner", "Spir-Margin codes") };
}
export async function confirmTwoFactor(code: string): Promise<boolean> {
  const secret = await readTotp("owner_totp_pending");
  if (!secret || !(await consumeCode(secret, code))) return false;
  const { run } = await codesDb();
  await setConfig(run, "owner_totp", (await getConfig(run, "owner_totp_pending"))!);
  await run.query(`delete from _spir_lic_config where key = 'owner_totp_pending'`);
  return true;
}
export async function disableTwoFactor(code: string): Promise<boolean> {
  if (!twoFactorForcedOff() && !(await checkOwnerCode(code))) return false;
  const { run } = await codesDb();
  await run.query(`delete from _spir_lic_config where key in ('owner_totp', 'owner_totp_pending')`);
  return true;
}
