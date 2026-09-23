import "server-only";
import http from "node:http";
import os from "node:os";
import { getDb, dumpLocalDatabase, type Db } from "@/lib/db/pglite";
import {
  nodeId, servePull, serveAccept, serveMeta, serveSnapshot,
  type ChangeRow, type PullPage, type SyncPeer, type SnapshotMeta, type SnapshotPage,
} from "./core";
import { encodeSyncCode, type LanCode } from "./code";
import { seal, unseal, newSecret } from "./seal";

export { newSecret };

/**
 * Sync over the office network.
 *
 * The main computer answers on a port of its own, separate from the program.
 * The program itself stays on 127.0.0.1 — it has a built-in administrator
 * account, and opening it to the network would open that too. This listener
 * answers exactly four requests and nothing else:
 *
 *   hello   who are you, and are we on the same version
 *   pull    a page of your change log
 *   push    here are changes from me
 *   clone   a full copy of your database, for a computer joining empty
 *
 * Every request and every answer is sealed with AES-256-GCM under a key
 * derived from the secret in the sync code, so on the wire they are opaque,
 * and a request that does not open is refused without reading further —
 * that IS the authentication. The operation name is bound in as associated
 * data, so a sealed request cannot be replayed as a different operation.
 * Replaying the same one gains nothing: a push is idempotent, and a pull's
 * answer is sealed too.
 */

export const DEFAULT_PORT = 3310;
const MAX_BODY = 64 * 1024 * 1024;

const json = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8");

// ------------------------------------------------------------------ this computer

/** The computer's name and IPv4 addresses on the office network. */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) out.push(a.address);
    }
  }
  return [os.hostname(), ...out];
}

async function schemaVersion(db: Db): Promise<string> {
  const r = await db.query<{ v: string | null }>(`select max(filename) as v from _spir_migrations`);
  return r.rows[0]?.v ?? "";
}

export interface ServerSetting {
  enabled: boolean;
  secret: string | null;
  port: number;
}

export async function readServerSetting(): Promise<ServerSetting> {
  const { db } = await getDb();
  const r = await db.query<{ enabled: boolean; secret: string | null; port: number }>(
    `select enabled, secret, port from _spir_lan_server`,
  );
  const row = r.rows[0];
  return { enabled: !!row?.enabled, secret: row?.secret ?? null, port: Number(row?.port ?? DEFAULT_PORT) };
}

/** The code other office computers paste, or null while serving is off. */
export async function mainComputerCode(label?: string): Promise<string | null> {
  const s = await readServerSetting();
  if (!s.enabled || !s.secret) return null;
  const { db } = await getDb();
  const code: LanCode = { k: "lan", a: lanAddresses(), p: s.port, s: s.secret, n: await nodeId(db) };
  if (label) code.c = label;
  return encodeSyncCode(code);
}


// ------------------------------------------------------------------ serving

interface Running {
  server: http.Server;
  port: number;
  secret: string;
  error: string | null;
}
const G = globalThis as unknown as { __spirLan?: Running | null };

/** Whether the listener is up, and if it could not start, why. */
export function listenerState(): { running: boolean; port: number | null; error: string | null } {
  const r = G.__spirLan;
  return { running: !!r && r.server.listening, port: r?.port ?? null, error: r?.error ?? null };
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("too large");
    parts.push(chunk as Buffer);
  }
  return Buffer.concat(parts);
}

async function noteClient(db: Db, node: string, name: string, address: string, patch: string, value: unknown) {
  await db
    .query(
      `insert into _spir_lan_clients (node_id, name, address) values ($1::uuid, $2, $3)
       on conflict (node_id) do update set name = excluded.name, address = excluded.address, last_seen = now()`,
      [node, name.slice(0, 120), address.slice(0, 80)],
    )
    .catch(() => undefined);
  if (patch) await db.query(patch, [node, value]).catch(() => undefined);
}

async function handle(op: string, body: Buffer, secret: string, address: string): Promise<Buffer> {
  const { db } = await getDb();
  if (op === "clone") {
    const req = JSON.parse(unseal(secret, op, body).toString("utf8")) as { node: string; name: string };
    await noteClient(db, req.node, req.name, address, "", null);
    const dump = Buffer.from(await (await dumpLocalDatabase()).arrayBuffer());
    return seal(secret, op, dump);
  }

  const req = JSON.parse(unseal(secret, op, body).toString("utf8")) as {
    node: string;
    name: string;
    after?: string | null;
    rows?: ChangeRow[];
    table?: string;
  };
  if (typeof req.node !== "string" || !/^[0-9a-f-]{36}$/i.test(req.node)) throw new Error("bad node");
  const tag = `n:${req.node}`;

  if (op === "hello") {
    await noteClient(db, req.node, req.name, address, "", null);
    return seal(secret, op, json({ node: await nodeId(db), name: os.hostname(), schema: await schemaVersion(db) }));
  }
  if (op === "pull") {
    const page: PullPage = await servePull(db, String(req.after ?? "0"), req.node, tag);
    await noteClient(
      db, req.node, req.name, address,
      `update _spir_lan_clients set pulled_through = greatest(pulled_through, $2::bigint) where node_id = $1::uuid`,
      page.through ?? "0",
    );
    return seal(secret, op, json(page));
  }
  if (op === "push") {
    const rows = Array.isArray(req.rows) ? req.rows.slice(0, 1000) : [];
    const results = await serveAccept(db, rows, tag);
    await noteClient(
      db, req.node, req.name, address,
      `update _spir_lan_clients set received = received + $2::bigint where node_id = $1::uuid`,
      results.filter((r) => r === null).length,
    );
    return seal(secret, op, json(results));
  }
  if (op === "meta") {
    await noteClient(db, req.node, req.name, address, "", null);
    return seal(secret, op, json(await serveMeta(db)));
  }
  if (op === "snap") {
    return seal(secret, op, json(await serveSnapshot(db, String(req.table ?? ""), req.after ?? null)));
  }
  throw new Error("unknown operation");
}

function start(port: number, secret: string): Promise<void> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const m = /^\/spir-sync\/(hello|pull|push|clone|meta|snap)$/.exec(req.url ?? "");
      if (req.method !== "POST" || !m) {
        res.writeHead(404).end();
        return;
      }
      const current = G.__spirLan?.secret ?? secret;
      try {
        const body = await readBody(req);
        const out = await handle(m[1], body, current, req.socket.remoteAddress ?? "");
        res.writeHead(200, { "content-type": "application/octet-stream" }).end(out);
      } catch (e) {
        const msg = (e as Error).message ?? "";
        // A request that does not open under our secret: the code is wrong,
        // or was changed here. Say only that.
        const refused = /unable to authenticate|auth|too short|Unsupported state/i.test(msg);
        if (!refused) console.error("[lan-sync]", m[1], msg);
        res.writeHead(refused ? 403 : 500).end();
      }
    });
    server.requestTimeout = 180_000;
    const state: Running = { server, port, secret, error: null };
    G.__spirLan = state;
    server.once("error", (e: NodeJS.ErrnoException) => {
      state.error = e.code === "EADDRINUSE" ? `port ${port} is in use` : e.message;
      console.error("[lan-sync] could not listen:", state.error);
      resolve();
    });
    server.listen(port, "0.0.0.0", () => resolve());
  });
}

async function stop(): Promise<void> {
  const r = G.__spirLan;
  G.__spirLan = null;
  if (r?.server.listening) await new Promise<void>((done) => r.server.close(() => done()));
}

/** Make the listener match the saved setting: start, stop, or restart it. */
export async function applyServerSetting(): Promise<void> {
  const s = await readServerSetting();
  const r = G.__spirLan;
  if (!s.enabled || !s.secret) {
    await stop();
    return;
  }
  if (r && r.server.listening && r.port === s.port) {
    r.secret = s.secret; // a new code takes effect at once, and old ones stop working
    return;
  }
  await stop();
  await start(s.port, s.secret);
}

// ------------------------------------------------------------------ calling

const lastGood = globalThis as unknown as { __spirLanAddr?: Record<string, string> };

export class WrongCodeError extends Error {}
export class UnreachableError extends Error {}

/** Send one sealed request to the main computer, trying each address it gave. */
export async function call(code: LanCode, op: string, payload: unknown, timeoutMs = 20_000): Promise<Buffer> {
  const remembered = (lastGood.__spirLanAddr ??= {})[code.n];
  const order = remembered ? [remembered, ...code.a.filter((a) => a !== remembered)] : code.a;
  const body = seal(code.s, op, json(payload));
  let lastErr = "";
  for (const addr of order) {
    try {
      const res = await fetch(`http://${addr}:${code.p}/spir-sync/${op}`, {
        method: "POST",
        body: new Uint8Array(body),
        headers: { "content-type": "application/octet-stream" },
        signal: AbortSignal.timeout(op === "clone" ? 300_000 : timeoutMs),
      });
      if (res.status === 403) throw new WrongCodeError("The main computer did not accept this sync code.");
      if (!res.ok) throw new Error(`The main computer answered ${res.status}`);
      const out = unseal(code.s, op, Buffer.from(await res.arrayBuffer()));
      lastGood.__spirLanAddr![code.n] = addr;
      return out;
    } catch (e) {
      if (e instanceof WrongCodeError) throw e;
      lastErr = (e as Error).message;
    }
  }
  throw new UnreachableError(lastErr || "unreachable");
}

export interface Hello {
  node: string;
  name: string;
  schema: string;
}

export async function hello(code: LanCode, me: string): Promise<Hello> {
  return JSON.parse((await call(code, "hello", { node: me, name: os.hostname() }, 8_000)).toString("utf8"));
}

export async function fetchClone(code: LanCode, me: string): Promise<Blob> {
  const buf = await call(code, "clone", { node: me, name: os.hostname() });
  return new Blob([new Uint8Array(buf)]);
}

/** The main computer as a sync peer. */
export function lanPeer(code: LanCode, me: string): SyncPeer {
  const name = os.hostname();
  return {
    key: "lan",
    pull: async (after, me) =>
      JSON.parse((await call(code, "pull", { node: me, name, after })).toString("utf8")) as PullPage,
    push: async (rows, me) =>
      JSON.parse((await call(code, "push", { node: me, name, rows })).toString("utf8")) as (string | null)[],
    meta: async () =>
      JSON.parse((await call(code, "meta", { node: me, name })).toString("utf8")) as SnapshotMeta,
    snapshot: async (table, after) =>
      JSON.parse((await call(code, "snap", { node: me, name, table, after })).toString("utf8")) as SnapshotPage,
  };
}

export { schemaVersion };
