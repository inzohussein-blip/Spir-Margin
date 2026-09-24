import "server-only";
import { getDb } from "@/lib/db/pglite";
import { newSecret } from "@/lib/sync/seal";
import { forgetDevices } from "./gateway";
import { PAIR_TTL_MINUTES, newPairCode, normalizePairCode, sha256 } from "./tokens";

/**
 * The devices allowed in from elsewhere (migration 0113), each one cut off
 * on its own:
 *
 *   browser   paired once through the gateway with a one-time code;
 *   computer  a full copy of the program, syncing with a code of its own.
 */

export interface Device {
  id: string;
  name: string;
  kind: "browser" | "computer";
  createdAt: string;
  lastSeenAt: string | null;
  lastAddress: string | null;
  revokedAt: string | null;
  /** A browser still waiting for its code to be typed, until when. */
  pairUntil: string | null;
  paired: boolean;
}

export async function listDevices(): Promise<Device[]> {
  const { db } = await getDb();
  const r = await db.query<{
    id: string; name: string; kind: Device["kind"]; created_at: string; last_seen_at: string | null;
    last_address: string | null; revoked_at: string | null; pair_expires_at: string | null; paired: boolean;
  }>(
    `select id, name, kind, created_at, last_seen_at, last_address, revoked_at,
            case when pair_expires_at > now() then pair_expires_at end as pair_expires_at,
            (token_hash is not null or kind = 'computer') as paired
       from _spir_devices
      order by revoked_at is not null, created_at desc`,
  );
  return r.rows.map((x) => ({
    id: x.id, name: x.name, kind: x.kind, createdAt: x.created_at, lastSeenAt: x.last_seen_at,
    lastAddress: x.last_address, revokedAt: x.revoked_at, pairUntil: x.pair_expires_at, paired: x.paired,
  }));
}

/** A browser to pair: returns the one-time code to type on it. */
export async function addBrowser(name: string): Promise<{ id: string; code: string }> {
  const code = newPairCode();
  const { db } = await getDb();
  const r = await db.query<{ id: string }>(
    `insert into _spir_devices (name, kind, pair_hash, pair_expires_at)
     values ($1, 'browser', $2, now() + make_interval(mins => $3)) returning id`,
    [name.slice(0, 120), sha256(normalizePairCode(code)), PAIR_TTL_MINUTES],
  );
  return { id: r.rows[0].id, code };
}

/** A new code for a browser (the first expired, or it is being moved to another browser). */
export async function repairBrowser(id: string): Promise<string | null> {
  const code = newPairCode();
  const { db } = await getDb();
  const r = await db.query(
    `update _spir_devices set pair_hash = $2, pair_expires_at = now() + make_interval(mins => $3), token_hash = null
      where id = $1::uuid and kind = 'browser' and revoked_at is null returning id`,
    [id, sha256(normalizePairCode(code)), PAIR_TTL_MINUTES],
  );
  forgetDevices();
  return r.rows.length ? code : null;
}

/** A computer with a sync code of its own: returns its id and secret. */
export async function addComputer(name: string): Promise<{ id: string; secret: string }> {
  const secret = newSecret();
  const { db } = await getDb();
  const r = await db.query<{ id: string }>(
    `insert into _spir_devices (name, kind, secret) values ($1, 'computer', $2) returning id`,
    [name.slice(0, 120), secret],
  );
  return { id: r.rows[0].id, secret };
}

export async function revokeDevice(id: string): Promise<void> {
  const { db } = await getDb();
  await db.query(
    `update _spir_devices set revoked_at = coalesce(revoked_at, now()), token_hash = null, pair_hash = null, secret = null
      where id = $1::uuid`,
    [id],
  );
  forgetDevices();
  forgetComputerSecrets();
}

/** Every computer's own code stops working (with the shared one: "make a new code"). */
export async function revokeAllComputers(): Promise<void> {
  const { db } = await getDb();
  await db.query(
    `update _spir_devices set revoked_at = now(), secret = null where kind = 'computer' and revoked_at is null`,
  );
  forgetComputerSecrets();
}

/** A removed device leaves the list; only cut-off ones can be removed. */
export async function removeDevice(id: string): Promise<void> {
  const { db } = await getDb();
  await db.query(`delete from _spir_devices where id = $1::uuid and revoked_at is not null`, [id]);
}

// ------------------------------------------------------------------ for the office-network listener

const G = globalThis as unknown as { __spirComputerSecrets?: Map<string, { secret: string | null; at: number }> };
const cache = () => (G.__spirComputerSecrets ??= new Map());

export function forgetComputerSecrets(): void {
  cache().clear();
}

/** The secret a computer's own code encrypts with; null if it was cut off. */
export async function computerSecret(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const hit = cache().get(id);
  if (hit && Date.now() - hit.at < 10_000) return hit.secret;
  const { db } = await getDb();
  const r = await db.query<{ secret: string | null }>(
    `select secret from _spir_devices where id = $1::uuid and kind = 'computer' and revoked_at is null`,
    [id],
  );
  const secret = r.rows[0]?.secret ?? null;
  cache().set(id, { secret, at: Date.now() });
  return secret;
}

export async function noteComputerSeen(id: string, address: string): Promise<void> {
  const { db } = await getDb();
  await db
    .query(`update _spir_devices set last_seen_at = now(), last_address = $2 where id = $1::uuid`, [id, address.slice(0, 80)])
    .catch(() => undefined);
}
