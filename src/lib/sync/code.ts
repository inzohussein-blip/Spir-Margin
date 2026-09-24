/**
 * Sync codes: what one computer shows and another pastes to link them.
 *
 *   SPIR1-<base64url of JSON>
 *
 * Two kinds. "lan": the main computer on the office network — where to find
 * it (its name and addresses, and a port) and the secret both ends encrypt
 * with. "pg": a hosted database's connection string, so a branch can be
 * linked without anyone retyping it.
 *
 * Either kind grants full access to the company's records, so a code is a
 * password: shown only to an administrator, and changed on the main computer
 * whenever it may have leaked (which also cuts off everyone who had it).
 * Self-contained, so the tests import it as is.
 */

export interface LanCode {
  k: "lan";
  /** Computer name first, then its IPv4 addresses: the name survives a new IP. */
  a: string[];
  p: number;
  /** 32 random bytes, base64url. */
  s: string;
  /** The main computer's node id, to refuse linking a computer to itself. */
  n: string;
  /** A label to show: the company name, or the computer's name. */
  c?: string;
  /**
   * This computer's own entry on the main computer (migration 0113): the
   * secret `s` is then its own, and cutting it off leaves the others alone.
   * Absent in the shared code every computer used before.
   */
  d?: string;
}

export interface PgCode {
  k: "pg";
  u: string;
}

export type SyncCode = LanCode | PgCode;

const PREFIX = "SPIR1-";

function toB64url(text: string): string {
  const b64 =
    typeof Buffer !== "undefined" ? Buffer.from(text, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return typeof Buffer !== "undefined" ? Buffer.from(b64, "base64").toString("utf8") : decodeURIComponent(escape(atob(b64)));
}

export function encodeSyncCode(code: SyncCode): string {
  return PREFIX + toB64url(JSON.stringify(code));
}

/** The code, or null for anything that is not a valid one. Whitespace is forgiven. */
export function decodeSyncCode(raw: string): SyncCode | null {
  const text = raw.replace(/\s+/g, "");
  if (!text.startsWith(PREFIX)) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(fromB64url(text.slice(PREFIX.length)));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.k === "pg") {
    return typeof o.u === "string" && /^postgres(ql)?:\/\//i.test(o.u) ? { k: "pg", u: o.u } : null;
  }
  if (o.k === "lan") {
    const a = Array.isArray(o.a) ? o.a.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
    const p = Number(o.p);
    if (!a.length || !Number.isInteger(p) || p < 1 || p > 65535) return null;
    if (typeof o.s !== "string" || o.s.length < 32) return null;
    if (typeof o.n !== "string" || !/^[0-9a-f-]{36}$/i.test(o.n)) return null;
    return {
      k: "lan", a, p, s: o.s, n: o.n,
      ...(typeof o.c === "string" ? { c: o.c } : {}),
      ...(typeof o.d === "string" && /^[0-9a-f-]{36}$/i.test(o.d) ? { d: o.d } : {}),
    };
  }
  return null;
}
