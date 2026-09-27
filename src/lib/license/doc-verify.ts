import crypto from "node:crypto";

/**
 * The QR on a printed document: the document's facts, signed with a key only
 * the company's computers and the codes server hold (the code's verify key,
 * delivered with the license). Signed on the computer — printing needs no
 * internet — and checked on the codes server's public /verify page, which
 * shows the facts so they can be compared with the paper. Pure (node:crypto).
 */

export interface DocFacts {
  /** Kind ("Invoice", "Quotation"…), number, date. */
  k: string; n: string; d: string;
  /** Total and currency, and the party it is addressed to (optional). */
  a?: number; c?: string; p?: string;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (key: string, body: string) => crypto.createHmac("sha256", key).update(`spir-doc:${body}`).digest("base64url").slice(0, 22);

export function signDoc(lid: string, key: string, f: DocFacts): string {
  const facts: Record<string, unknown> = { l: lid, k: f.k.slice(0, 40), n: f.n.slice(0, 40), d: f.d.slice(0, 10) };
  if (f.a != null && Number.isFinite(f.a)) facts.a = Math.round(f.a * 100) / 100;
  if (f.c) facts.c = f.c.slice(0, 5);
  if (f.p) facts.p = f.p.slice(0, 60);
  const body = b64(JSON.stringify(facts));
  return `${body}.${mac(key, body)}`;
}

/** The facts in a token, unchecked (null if it is not one). */
export function openDoc(token: string): (DocFacts & { l: string }) | null {
  const [body, sig] = String(token ?? "").split(".");
  if (!body || !sig || body.length > 800) return null;
  try {
    const f = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return f && typeof f.l === "string" && typeof f.k === "string" && typeof f.n === "string" ? f : null;
  } catch {
    return null;
  }
}

export function docValid(token: string, key: string): boolean {
  const [body, sig] = String(token ?? "").split(".");
  if (!body || !sig || !key) return false;
  const want = mac(key, body);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
