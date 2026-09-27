import "server-only";
import { verifyLicense, signingKeys, type Jwk } from "@/lib/license/core";
import { codesDb, codesServerEnabled, sealSecret } from "@/lib/license/server";

/**
 * Who may use cloud sync: a browser holding a genuine license (signed by this
 * site) for its code and for itself, whose seat is still valid — and only on
 * the database its own code carries. The seat is asked of the codes database
 * at most once a minute per browser.
 */
type Seat = { at: number; error: string | null };
type G = { __spirCloudPub?: Jwk; __spirCloudSeats?: Map<string, Seat> };
const g = globalThis as unknown as G;
const SEAT_MS = 60_000;

export type CloudAuth =
  | { ok: true; conn: string }
  | { ok: false; status: number; error: string };

export async function cloudAuth(lid: string, device: string, token: string): Promise<CloudAuth> {
  if (!codesServerEnabled()) return { ok: false, status: 404, error: "disabled" };
  if (!lid || !device || !token) return { ok: false, status: 400, error: "bad_request" };
  const { run, licenses } = await codesDb();
  g.__spirCloudPub ??= (await signingKeys(run, sealSecret())).pub;
  const p = verifyLicense(token, g.__spirCloudPub);
  if (!p || p.lid !== lid || p.dev !== device) return { ok: false, status: 401, error: "not_licensed" };
  if (p.until <= Date.now()) return { ok: false, status: 403, error: "expired" };

  const seats = (g.__spirCloudSeats ??= new Map());
  const key = `${lid}|${device}`;
  let seat = seats.get(key);
  if (!seat || Date.now() - seat.at > SEAT_MS) {
    const r = await licenses.check(lid, device);
    seat = { at: Date.now(), error: r.ok ? null : r.error };
    seats.set(key, seat);
  }
  if (seat.error) return { ok: false, status: 403, error: seat.error };

  const link = await licenses.getSync(lid);
  if (!link?.conn) return { ok: false, status: 409, error: "no_company_db" };
  return { ok: true, conn: link.conn };
}
