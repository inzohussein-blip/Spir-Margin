import crypto from "node:crypto";

/**
 * Activation codes («منظومة الرموز») — the framework-free core, shared by the
 * codes server (the web version, /licenses) and imported by the tests as is.
 *
 * One code per subscribing company. The owner sets how many computers it may
 * run on (seats), for how many days, and which stations it opens. The first
 * computer that enters the code starts the period; each further computer takes
 * a seat until they are used up. The code itself is kept only as a hash.
 *
 * A computer receives a license signed with an ES256 key. The private key is
 * kept in the codes database sealed with AUTH_SECRET, so a copy of that
 * database alone cannot sign. The computer checks the signature offline on
 * every start and refreshes it from the server when it is online.
 *
 * Everything here takes a Runner (PGlite or node-postgres) and uses only
 * node:crypto, so it runs the same in the app and in the tests.
 */

export interface Runner {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export const DAY = 86_400_000;
export const MAX_SEATS = 100;
export const MAX_DAYS = 3650;

// ── What a license carries ──────────────────────────────────────────────────

export interface LicensePayload {
  /** The code's id. */
  lid: string;
  /** The subscribing company's name. */
  co: string;
  /** The computer this license is bound to. */
  dev: string;
  /** The stations it opens. */
  mods: string[];
  /** Expiry, ms since epoch. */
  until: number;
  /** How many computers the code allows (shown on the device). */
  seats: number;
  iat?: number;
}

export interface LicenseDevice {
  device_id: string;
  label: string;
  name: string;
  activated_at: number;
  last_seen_at: number | null;
  app_version: string;
}

export interface SyncInfo {
  /** "db.xxx.supabase.co:5432/postgres" — never the password. */
  host: string;
  by: "owner" | "device";
  at: number;
}

export interface LicenseRow {
  id: string;
  company: string;
  note: string;
  code_hint: string;
  duration_days: number;
  seats: number;
  modules: string[];
  status: "active" | "stopped";
  activated_at: number | null;
  expires_at: number | null;
  created_at: number;
  price: string;
  paid: boolean;
  paid_at: number | null;
  message: string;
  is_trial: boolean;
  sync: SyncInfo | null;
  devices: LicenseDevice[];
}

export interface LicenseEvent { license_id: string; at: number; kind: string; detail: string }

// ── Codes ────────────────────────────────────────────────────────────────────

/** No 0/O, 1/I/L: a code read out over the phone survives. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const normalizeCode = (c: string) => String(c ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
export const hashCode = (c: string) => crypto.createHash("sha256").update("spir-code:" + normalizeCode(c)).digest("hex");
export function newCode(): string {
  const b = crypto.randomBytes(12);
  const s = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** A version string as the app reports it ("build-42"); anything else is dropped. */
export const cleanVersion = (v: unknown) => (typeof v === "string" && /^[\w.-]{1,40}$/.test(v) ? v : "");

// ── Signed licenses (JWT, ES256, node:crypto only) ─────────────────────────

export type Jwk = crypto.JsonWebKey;
const b64u = (b: Buffer) => b.toString("base64url");

export function newKeyPair(): { priv: Jwk; pub: Jwk } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { priv: privateKey.export({ format: "jwk" }), pub: publicKey.export({ format: "jwk" }) };
}

export function signLicense(p: Omit<LicensePayload, "iat">, priv: Jwk, now = Date.now()): string {
  const head = b64u(Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const body = b64u(Buffer.from(JSON.stringify({ ...p, iat: Math.floor(now / 1000) })));
  const key = crypto.createPrivateKey({ key: priv, format: "jwk" });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}

/** The payload when the signature is genuine; null otherwise (expiry is judged by the caller). */
export function verifyLicense(token: string, pub: Jwk): LicensePayload | null {
  try {
    const [h, b, s] = String(token ?? "").split(".");
    if (!h || !b || !s) return null;
    const head = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    if (head?.alg !== "ES256") return null;
    const key = crypto.createPublicKey({ key: pub, format: "jwk" });
    const ok = crypto.verify("sha256", Buffer.from(`${h}.${b}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    if (!ok) return null;
    const p = JSON.parse(Buffer.from(b, "base64url").toString("utf8")) as LicensePayload;
    return typeof p.lid === "string" && typeof p.dev === "string" && Array.isArray(p.mods) && Number.isFinite(p.until) ? p : null;
  } catch {
    return null;
  }
}

// ── Sealing with AUTH_SECRET (AES-256-GCM) ──────────────────────────────────

export interface Sealed { iv: string; tag: string; data: string }
const sealKey = (secret: string) => crypto.createHash("sha256").update(`spir-license-seal:${secret}`).digest();
export function sealText(text: string, secret: string, aad: string): Sealed {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", sealKey(secret), iv);
  c.setAAD(Buffer.from(aad));
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function unsealText(s: Sealed, secret: string, aad: string): string | null {
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", sealKey(secret), Buffer.from(s.iv, "base64"));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(Buffer.from(s.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── Tables (created on first use, in the codes database) ────────────────────

export async function ensureTables(run: Runner): Promise<void> {
  await run.query(`create table if not exists _spir_lic (
    id text primary key,
    code_hash text unique not null,
    code_hint text not null default '',
    company text not null,
    note text not null default '',
    duration_days integer not null,
    seats integer not null default 1,
    modules text not null default '[]',
    status text not null default 'active',
    activated_at bigint,
    expires_at bigint,
    created_at bigint not null,
    price text not null default '',
    paid boolean not null default false,
    paid_at bigint,
    message text not null default '',
    is_trial boolean not null default false,
    sync_config text not null default '',
    sync_info text not null default '')`);
  await run.query(`create table if not exists _spir_lic_devices (
    license_id text not null,
    device_id text not null,
    label text not null default '',
    name text not null default '',
    activated_at bigint not null,
    last_seen_at bigint,
    app_version text not null default '',
    primary key (license_id, device_id))`);
  await run.query(`create table if not exists _spir_lic_config (key text primary key, value text not null default '')`);
  await run.query(`create table if not exists _spir_lic_events (
    id text primary key, license_id text not null, at bigint not null, kind text not null, detail text not null default '')`);
  await run.query(`create index if not exists _spir_lic_events_license on _spir_lic_events (license_id, at desc)`);
  await run.query(`create table if not exists _spir_lic_attempts (id text primary key, k text not null, at bigint not null)`);
  await run.query(`create index if not exists _spir_lic_attempts_k on _spir_lic_attempts (k, at)`);
  await run.query(`create table if not exists _spir_lic_owner_log (
    id text primary key, at bigint not null, ok boolean not null, ip text not null default '', agent text not null default '')`);
}

export async function getConfig(run: Runner, key: string): Promise<string | null> {
  const r = await run.query<{ value: string }>(`select value from _spir_lic_config where key = $1`, [key]);
  return r.rows[0]?.value ?? null;
}
export async function setConfig(run: Runner, key: string, value: string): Promise<void> {
  await run.query(
    `insert into _spir_lic_config (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`,
    [key, value],
  );
}

// ── The signing key (sealed with AUTH_SECRET) ───────────────────────────────

interface StoredKey { v: 1; pub: Jwk; sealed: Sealed }

/**
 * The signing key pair. Generated once and stored sealed; a key that no longer
 * opens (AUTH_SECRET changed) is replaced — computers keep their current
 * license offline and receive the new public key at their next online check.
 * Several server instances starting together settle on one key.
 */
export async function signingKeys(run: Runner, secret: string): Promise<{ priv: Jwk; pub: Jwk }> {
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const open = (raw: string | null) => {
    if (!raw) return null;
    try {
      const k = JSON.parse(raw) as StoredKey;
      const t = unsealText(k.sealed, secret, JSON.stringify(k.pub));
      return t ? { priv: JSON.parse(t) as Jwk, pub: k.pub } : null;
    } catch {
      return null;
    }
  };
  const saved = await getConfig(run, "signing_key");
  const cur = open(saved);
  if (cur) return cur;
  const kp = newKeyPair();
  const value = JSON.stringify({ v: 1, pub: kp.pub, sealed: sealText(JSON.stringify(kp.priv), secret, JSON.stringify(kp.pub)) } satisfies StoredKey);
  if (saved == null) {
    await run.query(`insert into _spir_lic_config (key, value) values ('signing_key', $1) on conflict (key) do nothing`, [value]);
  } else {
    await run.query(`update _spir_lic_config set value = $1 where key = 'signing_key' and value = $2`, [value, saved]);
  }
  const back = open(await getConfig(run, "signing_key"));
  if (!back) throw new Error("signing key unavailable");
  return back;
}

// ── Rows ─────────────────────────────────────────────────────────────────────

const num = (v: unknown) => (v == null ? null : Number(v));
const bool = (v: unknown) => v === true || v === "t" || v === "true";

type RawLicense = Record<string, unknown>;
const COLS = `id, company, note, code_hint, duration_days, seats, modules, status, activated_at, expires_at,
  created_at, price, paid, paid_at, message, is_trial, sync_info`;

function toRow(r: RawLicense, devices: LicenseDevice[], cleanModules: (v: unknown) => string[]): LicenseRow {
  let mods: unknown = [];
  try { mods = JSON.parse(String(r.modules ?? "[]")); } catch { /* keep empty */ }
  let sync: SyncInfo | null = null;
  try { sync = r.sync_info ? (JSON.parse(String(r.sync_info)) as SyncInfo) : null; } catch { /* none */ }
  return {
    id: String(r.id),
    company: String(r.company ?? ""),
    note: String(r.note ?? ""),
    code_hint: String(r.code_hint ?? ""),
    duration_days: Number(r.duration_days),
    seats: Number(r.seats ?? 1),
    modules: cleanModules(mods),
    status: r.status === "stopped" ? "stopped" : "active",
    activated_at: num(r.activated_at),
    expires_at: num(r.expires_at),
    created_at: Number(r.created_at),
    price: String(r.price ?? ""),
    paid: bool(r.paid),
    paid_at: num(r.paid_at),
    message: String(r.message ?? ""),
    is_trial: bool(r.is_trial),
    sync,
    devices,
  };
}

function toDevice(r: Record<string, unknown>): LicenseDevice {
  return {
    device_id: String(r.device_id),
    label: String(r.label ?? ""),
    name: String(r.name ?? ""),
    activated_at: Number(r.activated_at),
    last_seen_at: num(r.last_seen_at),
    app_version: String(r.app_version ?? ""),
  };
}

export class Licenses {
  constructor(
    private run: Runner,
    /** AUTH_SECRET: seals the signing key and each code's database link. */
    private secret: string,
    /** Keeps only station ids this app knows; an empty/garbled value gives the default set. */
    private cleanModules: (v: unknown) => string[],
  ) {}

  private async devicesOf(ids: string[]): Promise<Map<string, LicenseDevice[]>> {
    const out = new Map<string, LicenseDevice[]>();
    if (!ids.length) return out;
    const r = await this.run.query<Record<string, unknown>>(
      `select license_id, device_id, label, name, activated_at, last_seen_at, app_version
         from _spir_lic_devices where license_id = any($1) order by activated_at`,
      [ids],
    );
    for (const d of r.rows) {
      const k = String(d.license_id);
      out.set(k, [...(out.get(k) ?? []), toDevice(d)]);
    }
    return out;
  }

  async list(): Promise<LicenseRow[]> {
    const r = await this.run.query<RawLicense>(`select ${COLS} from _spir_lic order by created_at desc`);
    const devices = await this.devicesOf(r.rows.map((x) => String(x.id)));
    return r.rows.map((x) => toRow(x, devices.get(String(x.id)) ?? [], this.cleanModules));
  }

  async get(id: string): Promise<LicenseRow | null> {
    const r = await this.run.query<RawLicense>(`select ${COLS} from _spir_lic where id = $1`, [id]);
    if (!r.rows[0]) return null;
    const devices = await this.devicesOf([id]);
    return toRow(r.rows[0], devices.get(id) ?? [], this.cleanModules);
  }

  // ── History ────────────────────────────────────────────────────────────────
  async log(licenseId: string, kind: string, detail = ""): Promise<void> {
    try {
      await this.run.query(`insert into _spir_lic_events (id, license_id, at, kind, detail) values ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), licenseId, Date.now(), kind, detail.slice(0, 300)]);
    } catch { /* history never blocks the action */ }
  }
  async events(limit = 2000): Promise<LicenseEvent[]> {
    const r = await this.run.query<Record<string, unknown>>(
      `select license_id, at, kind, detail from _spir_lic_events order by at desc limit $1`, [limit]);
    return r.rows.map((e) => ({ license_id: String(e.license_id), at: Number(e.at), kind: String(e.kind), detail: String(e.detail ?? "") }));
  }

  // ── Owner actions ─────────────────────────────────────────────────────────
  async create(v: { company: string; days: number; seats: number; modules: unknown; note?: string; trial?: boolean }): Promise<{ row: LicenseRow; code: string }> {
    const code = newCode();
    const id = crypto.randomUUID();
    const days = Math.max(1, Math.min(MAX_DAYS, Math.round(v.days)));
    const seats = Math.max(1, Math.min(MAX_SEATS, Math.round(v.seats || 1)));
    await this.run.query(
      `insert into _spir_lic (id, code_hash, code_hint, company, note, duration_days, seats, modules, created_at, is_trial)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, hashCode(code), code.slice(-4), v.company.trim().slice(0, 120), (v.note ?? "").trim().slice(0, 300), days, seats,
        JSON.stringify(this.cleanModules(v.modules)), Date.now(), !!v.trial],
    );
    await this.log(id, "created", `${v.trial ? "trial · " : ""}${days}d · ${seats}`);
    return { row: (await this.get(id))!, code };
  }

  async update(id: string, a: LicenseAction): Promise<{ row: LicenseRow | null; code?: string }> {
    const cur = await this.get(id);
    if (!cur) return { row: null };
    switch (a.action) {
      case "extend": {
        const days = Math.max(1, Math.min(MAX_DAYS, Math.round(Number(a.days))));
        if (cur.expires_at == null) {
          await this.run.query(`update _spir_lic set duration_days = duration_days + $2 where id = $1`, [id, days]);
        } else {
          const until = Math.max(cur.expires_at, Date.now()) + days * DAY;
          await this.run.query(`update _spir_lic set expires_at = $2 where id = $1`, [id, until]);
        }
        await this.log(id, "extended", `+${days}`);
        break;
      }
      case "stop": await this.run.query(`update _spir_lic set status = 'stopped' where id = $1`, [id]); await this.log(id, "stopped"); break;
      case "resume": await this.run.query(`update _spir_lic set status = 'active' where id = $1`, [id]); await this.log(id, "resumed"); break;
      case "seats": {
        const seats = Math.max(1, Math.min(MAX_SEATS, Math.round(Number(a.seats))));
        await this.run.query(`update _spir_lic set seats = $2 where id = $1`, [id, seats]);
        await this.log(id, "seats", String(seats));
        break;
      }
      case "reset_device": {
        const d = cur.devices.find((x) => x.device_id === a.device);
        await this.run.query(`delete from _spir_lic_devices where license_id = $1 and device_id = $2`, [id, a.device]);
        if (d) await this.log(id, "device_reset", d.name || d.label);
        break;
      }
      case "device_name":
        await this.run.query(`update _spir_lic_devices set name = $3 where license_id = $1 and device_id = $2`,
          [id, a.device, String(a.name ?? "").trim().slice(0, 60)]);
        break;
      case "modules": {
        const mods = this.cleanModules(a.modules);
        await this.run.query(`update _spir_lic set modules = $2 where id = $1`, [id, JSON.stringify(mods)]);
        await this.log(id, "modules", mods.join(","));
        break;
      }
      case "rename": {
        const company = String(a.company ?? "").trim().slice(0, 120) || cur.company;
        await this.run.query(`update _spir_lic set company = $2, note = $3 where id = $1`,
          [id, company, String(a.note ?? cur.note).trim().slice(0, 300)]);
        await this.log(id, "renamed", company);
        break;
      }
      case "payment": {
        const price = String(a.price ?? "").trim().slice(0, 40);
        const paid = !!a.paid;
        await this.run.query(`update _spir_lic set price = $2, paid = $3, paid_at = $4 where id = $1`,
          [id, price, paid, paid ? (cur.paid ? cur.paid_at : Date.now()) : null]);
        if (paid !== cur.paid || price !== cur.price) await this.log(id, paid ? "paid" : "unpaid", price);
        break;
      }
      case "message": {
        const text = String(a.text ?? "").trim().slice(0, 300);
        await this.run.query(`update _spir_lic set message = $2 where id = $1`, [id, text]);
        await this.log(id, "message", text || "—");
        break;
      }
      case "new_code": {
        const code = newCode();
        await this.run.query(`update _spir_lic set code_hash = $2, code_hint = $3 where id = $1`, [id, hashCode(code), code.slice(-4)]);
        await this.log(id, "new_code", `…${code.slice(-4)}`);
        return { row: await this.get(id), code };
      }
      case "delete":
        await this.run.query(`delete from _spir_lic_devices where license_id = $1`, [id]);
        await this.run.query(`delete from _spir_lic where id = $1`, [id]);
        await this.run.query(`delete from _spir_lic_events where license_id = $1`, [id]);
        return { row: null };
    }
    return { row: await this.get(id) };
  }

  // ── Computer side ────────────────────────────────────────────────────────
  private async issue(row: LicenseRow, device: string): Promise<DeviceResult> {
    const { priv, pub } = await signingKeys(this.run, this.secret);
    const token = signLicense({ lid: row.id, co: row.company, dev: device, mods: row.modules, until: row.expires_at!, seats: row.seats }, priv);
    return { ok: true, token, pub, row, sync: await this.deviceSync(row.id) };
  }

  /**
   * A company enters its code on a computer. The first computer starts the
   * period; others take a seat while seats remain; a computer already holding
   * one simply receives its license again.
   */
  async activate(code: string, device: string, label: string, version = ""): Promise<DeviceResult> {
    const r = await this.run.query<{ id: string }>(`select id from _spir_lic where code_hash = $1`, [hashCode(code)]);
    const row = r.rows[0] ? await this.get(r.rows[0].id) : null;
    if (!row) return { ok: false, error: "not_found" };
    if (row.status === "stopped") return { ok: false, error: "stopped", row };
    const now = Date.now();
    if (row.expires_at != null && row.expires_at <= now) return { ok: false, error: "expired", row };
    const held = row.devices.some((d) => d.device_id === device);
    if (!held && row.devices.length >= row.seats) return { ok: false, error: "seats_full", row };
    const expires = row.expires_at ?? now + row.duration_days * DAY;
    if (row.activated_at == null) {
      await this.run.query(`update _spir_lic set activated_at = $2, expires_at = $3 where id = $1`, [row.id, now, expires]);
    }
    if (held) {
      await this.run.query(`update _spir_lic_devices set last_seen_at = $3, app_version = $4, label = $5 where license_id = $1 and device_id = $2`,
        [row.id, device, now, cleanVersion(version), label.slice(0, 160)]);
    } else {
      await this.run.query(
        `insert into _spir_lic_devices (license_id, device_id, label, activated_at, last_seen_at, app_version)
         values ($1, $2, $3, $4, $4, $5)`,
        [row.id, device, label.slice(0, 160), now, cleanVersion(version)],
      );
      await this.log(row.id, "activated", label.slice(0, 80));
    }
    return this.issue((await this.get(row.id))!, device);
  }

  /** Periodic check from an activated computer: the current state, signed again. */
  async check(lid: string, device: string, version = ""): Promise<DeviceResult> {
    const row = await this.get(lid);
    if (!row) return { ok: false, error: "not_found" };
    if (!row.devices.some((d) => d.device_id === device)) return { ok: false, error: "other_device", row };
    const v = cleanVersion(version);
    await this.run.query(
      `update _spir_lic_devices set last_seen_at = $3${v ? ", app_version = $4" : ""} where license_id = $1 and device_id = $2`,
      v ? [lid, device, Date.now(), v] : [lid, device, Date.now()],
    );
    if (row.status === "stopped") return { ok: false, error: "stopped", row };
    if (row.expires_at != null && row.expires_at <= Date.now()) return { ok: false, error: "expired", row };
    return this.issue(row, device);
  }

  // ── The company's own database, carried by its code ─────────────────────
  // Sealed with AUTH_SECRET and bound to the code's id: a copy of the codes
  // database alone reveals no company's connection details.
  private syncAad = (id: string) => `spir-lic-sync:${id}`;

  async getSync(id: string): Promise<{ conn: string; by: "owner" | "device" } | null> {
    const r = await this.run.query<{ sync_config: string }>(`select sync_config from _spir_lic where id = $1`, [id]);
    const raw = r.rows[0]?.sync_config;
    if (!raw || !this.secret) return null;
    try {
      const t = unsealText(JSON.parse(raw) as Sealed, this.secret, this.syncAad(id));
      return t ? (JSON.parse(t) as { conn: string; by: "owner" | "device" }) : null;
    } catch {
      return null;
    }
  }

  /** Link a code to the company's database (null unlinks). `host` is what the list shows. */
  async setSync(id: string, conn: string | null, host: string, by: "owner" | "device"): Promise<"not_found" | "no_secret" | null> {
    if (!(await this.get(id))) return "not_found";
    if (!conn) {
      await this.run.query(`update _spir_lic set sync_config = '', sync_info = '' where id = $1`, [id]);
      await this.log(id, "sync", "—");
      return null;
    }
    if (!this.secret) return "no_secret";
    const info: SyncInfo = { host, by, at: Date.now() };
    await this.run.query(`update _spir_lic set sync_config = $2, sync_info = $3 where id = $1`,
      [id, JSON.stringify(sealText(JSON.stringify({ conn, by }), this.secret, this.syncAad(id))), JSON.stringify(info)]);
    await this.log(id, "sync", `${host}${by === "device" ? " (device)" : ""}`);
    return null;
  }

  /** Record, without the address itself, that a computer linked its own database. */
  async noteDeviceSync(id: string, host: string): Promise<void> {
    const cur = await this.get(id);
    if (!cur || cur.sync?.by === "owner") return;
    if (cur.sync?.host === host) return;
    const info: SyncInfo | null = host ? { host, by: "device", at: Date.now() } : null;
    await this.run.query(`update _spir_lic set sync_info = $2 where id = $1 and sync_config = ''`, [id, info ? JSON.stringify(info) : ""]);
  }

  private async deviceSync(id: string): Promise<DeviceSync | null> {
    const s = await this.getSync(id).catch(() => null);
    return s ? { conn: s.conn, at: Date.now() } : null;
  }

  // ── Attempt limits (in the database: they hold across server instances) ──
  async blocked(kind: "activate" | "owner", ip: string, max: number, windowMs = 10 * 60_000): Promise<boolean> {
    try {
      const r = await this.run.query<{ n: string | number }>(`select count(*) as n from _spir_lic_attempts where k = $1 and at > $2`,
        [`${kind}:${ip}`, Date.now() - windowMs]);
      return Number(r.rows[0]?.n ?? 0) >= max;
    } catch {
      return false; // never lock anyone out because the counter is unreachable
    }
  }
  async noteAttempt(kind: "activate" | "owner", ip: string): Promise<void> {
    try {
      await this.run.query(`insert into _spir_lic_attempts (id, k, at) values ($1, $2, $3)`, [crypto.randomUUID(), `${kind}:${ip}`, Date.now()]);
      await this.run.query(`delete from _spir_lic_attempts where at < $1`, [Date.now() - DAY]);
    } catch { /* ignore */ }
  }
  async clearAttempts(kind: "activate" | "owner", ip: string): Promise<void> {
    try { await this.run.query(`delete from _spir_lic_attempts where k = $1`, [`${kind}:${ip}`]); } catch { /* ignore */ }
  }

  // ── Owner sign-in log ────────────────────────────────────────────────────
  async logSignIn(ok: boolean, ip: string, agent: string): Promise<void> {
    try {
      await this.run.query(`insert into _spir_lic_owner_log (id, at, ok, ip, agent) values ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), Date.now(), ok, ip.slice(0, 64), agent.slice(0, 80)]);
      await this.run.query(`delete from _spir_lic_owner_log where at < $1`, [Date.now() - 180 * DAY]);
    } catch { /* never blocks signing in */ }
  }
  async signIns(limit = 30): Promise<{ at: number; ok: boolean; ip: string; agent: string }[]> {
    try {
      const r = await this.run.query<Record<string, unknown>>(`select at, ok, ip, agent from _spir_lic_owner_log order by at desc limit $1`, [limit]);
      return r.rows.map((x) => ({ at: Number(x.at), ok: bool(x.ok), ip: String(x.ip ?? ""), agent: String(x.agent ?? "") }));
    } catch {
      return [];
    }
  }

  // ── Backup of the codes ──────────────────────────────────────────────────
  // Codes as hashes (the codes themselves are never stored), devices, history
  // and the contact line. The signing key is left out: after a restore the
  // server makes a new one and every computer picks it up at its next check.
  async exportAll(): Promise<CodesBackup> {
    const licenses = (await this.run.query<Record<string, unknown>>(`select * from _spir_lic order by created_at`)).rows;
    const devices = (await this.run.query<Record<string, unknown>>(`select * from _spir_lic_devices order by activated_at`)).rows;
    const events = (await this.run.query<Record<string, unknown>>(`select * from _spir_lic_events order by at`)).rows;
    return { app: "spir-codes", version: 1, exported_at: new Date().toISOString(), licenses, devices, events, contact: (await getConfig(this.run, "contact")) ?? "" };
  }

  /** Merge a backup in: codes and devices are added or updated; nothing is deleted. */
  async importAll(data: unknown): Promise<{ licenses: number; devices: number; events: number }> {
    const b = data as Partial<CodesBackup>;
    if (!b || b.app !== "spir-codes" || !Array.isArray(b.licenses)) throw new Error("invalid");
    let nl = 0, nd = 0, ne = 0;
    for (const r of b.licenses) {
      if (typeof r.id !== "string" || typeof r.code_hash !== "string" || typeof r.company !== "string") continue;
      const vals = LIC_COLS.map((c) => {
        const v = r[c];
        if (c === "paid" || c === "is_trial") return bool(v);
        if (c === "modules") return typeof v === "string" ? v : JSON.stringify(this.cleanModules(v));
        if (c === "seats") return Math.max(1, Math.min(MAX_SEATS, Number(v) || 1));
        return v ?? (TEXT_COLS.has(c) ? "" : c === "status" ? "active" : null);
      });
      await this.run.query(
        `insert into _spir_lic (${LIC_COLS.join(", ")}) values (${LIC_COLS.map((_, i) => `$${i + 1}`).join(", ")})
         on conflict (id) do update set ${LIC_COLS.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ")}`,
        vals,
      );
      nl++;
    }
    for (const d of b.devices ?? []) {
      if (typeof d.license_id !== "string" || typeof d.device_id !== "string") continue;
      await this.run.query(
        `insert into _spir_lic_devices (license_id, device_id, label, name, activated_at, last_seen_at, app_version)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (license_id, device_id) do update set label = excluded.label, name = excluded.name, last_seen_at = excluded.last_seen_at, app_version = excluded.app_version`,
        [d.license_id, d.device_id, String(d.label ?? ""), String(d.name ?? ""), Number(d.activated_at) || Date.now(), num(d.last_seen_at), String(d.app_version ?? "")],
      );
      nd++;
    }
    for (const e of b.events ?? []) {
      if (typeof e.id !== "string" || typeof e.license_id !== "string") continue;
      await this.run.query(`insert into _spir_lic_events (id, license_id, at, kind, detail) values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
        [e.id, e.license_id, Number(e.at), String(e.kind ?? ""), String(e.detail ?? "")]);
      ne++;
    }
    if (typeof b.contact === "string" && b.contact.trim()) await setConfig(this.run, "contact", b.contact.trim().slice(0, 300));
    return { licenses: nl, devices: nd, events: ne };
  }
}

const LIC_COLS = ["id", "code_hash", "code_hint", "company", "note", "duration_days", "seats", "modules", "status", "activated_at",
  "expires_at", "created_at", "price", "paid", "paid_at", "message", "is_trial", "sync_config", "sync_info"] as const;
const TEXT_COLS = new Set<string>(["note", "code_hint", "price", "message", "sync_config", "sync_info"]);

export interface CodesBackup {
  app: "spir-codes";
  version: 1;
  exported_at: string;
  licenses: Record<string, unknown>[];
  devices: Record<string, unknown>[];
  events: Record<string, unknown>[];
  contact: string;
}

/** What a computer receives about its company's database: the connection itself (the computer is trusted — it stores its own link the same way). */
export interface DeviceSync { conn: string; at: number }

export type DeviceResult =
  | { ok: true; token: string; pub: Jwk; row: LicenseRow; sync: DeviceSync | null }
  | { ok: false; error: "not_found" | "other_device" | "stopped" | "expired" | "seats_full"; row?: LicenseRow };

export type LicenseAction =
  | { action: "extend"; days: number }
  | { action: "stop" }
  | { action: "resume" }
  | { action: "seats"; seats: number }
  | { action: "reset_device"; device: string }
  | { action: "device_name"; device: string; name: string }
  | { action: "modules"; modules: unknown }
  | { action: "rename"; company: string; note?: string }
  | { action: "payment"; price: string; paid: boolean }
  | { action: "message"; text: string }
  | { action: "new_code" }
  | { action: "delete" };
