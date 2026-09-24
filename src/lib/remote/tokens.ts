import crypto from "node:crypto";

/**
 * Tokens and addresses for remote access (migration 0113). Self-contained,
 * so the tests import it as is.
 *
 * A browser is paired once with a short one-time code typed on it, and from
 * then on carries a long random token in a cookie: `spir_device=<id>.<token>`.
 * Only a hash of either is kept, so a copy of the database lets nobody in.
 */

export const DEVICE_COOKIE = "spir_device";
/** How long a pairing code works after it is made. */
export const PAIR_TTL_MINUTES = 15;
/** A paired browser stays paired for 400 days, the longest a cookie may live. */
export const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 3600;

/** Eight digits, shown as 1234-5678: easy to read out and to type on a phone. */
export function newPairCode(): string {
  const n = String(crypto.randomInt(0, 100_000_000)).padStart(8, "0");
  return `${n.slice(0, 4)}-${n.slice(4)}`;
}

/** What was typed, as the digits alone — spaces, dashes and Arabic-Indic digits forgiven. */
export function normalizePairCode(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The device cookie's value from a Cookie header, split, or null. */
export function readDeviceCookie(cookieHeader: string | undefined): { id: string; token: string } | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== DEVICE_COOKIE) continue;
    const value = decodeURIComponent(part.slice(i + 1).trim());
    const dot = value.indexOf(".");
    const id = value.slice(0, dot);
    const token = value.slice(dot + 1);
    if (dot > 0 && UUID.test(id) && token.length >= 32) return { id, token };
  }
  return null;
}

/** The Cookie header with the device cookie taken out: the program has no use for it. */
export function withoutDeviceCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return cookieHeader;
  const rest = cookieHeader
    .split(";")
    .filter((p) => p.split("=")[0].trim() !== DEVICE_COOKIE)
    .join(";")
    .trim();
  return rest || undefined;
}

export type AddressKind = "tailscale" | "lan" | "name";

/** Tailscale gives each device an address in 100.64.0.0/10. */
export function isTailscale(ip: string): boolean {
  const m = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  return !!m && Number(m[1]) >= 64 && Number(m[1]) <= 127;
}

export function addressKind(a: string): AddressKind {
  if (isTailscale(a)) return "tailscale";
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(a) ? "lan" : "name";
}

/**
 * A redirect to the program's own local address (it names itself
 * localhost:3000), made relative, so the other device follows it back
 * through the gateway rather than to its own localhost.
 */
export function ownAddressToPath(location: string, appPort: number): string {
  let u: URL;
  try {
    u = new URL(location);
  } catch {
    return location; // already relative
  }
  const local = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(u.hostname);
  return local && Number(u.port || 80) === appPort ? `${u.pathname}${u.search}${u.hash}` : location;
}

/**
 * Attempts at pairing, per address: a few mistakes are fine, a search
 * through a hundred million codes is not.
 */
export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = 10, private windowMs = 15 * 60_000) {}

  /** Whether another attempt is allowed now; records it if so. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.hits.clear(); // never grows without bound
    return true;
  }
}
