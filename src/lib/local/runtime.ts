/**
 * The web version's local app, underneath the screens: the company's own
 * Postgres running in this browser (PGlite in a worker, kept in IndexedDB),
 * migrated with the same files as every installed computer, and synced with
 * the company's hosted database through the site (/api/cloud) whenever the
 * internet is there. Everything works without it; what was done offline goes
 * up at the next sync.
 *
 * One runtime per page, on `window`. Screens read through `client` (the same
 * query builder the server uses, rest-core.ts) and listen for "change".
 */
import { PgRestClient, plainDbError, introspect, type Db, type FkMeta, type DbError } from "@/lib/db/rest-core";
import { describeDbError } from "@/lib/db/errors";
import { migrateLocal, type Migration } from "./migrate";
import { syncOnce, pendingCount } from "@/lib/sync/core";
import { cloudPeer, type CloudRequest } from "@/lib/cloud/serve";
import { loadLicense, saveLicense, localState, deviceId, browserLabel, hashCode, type LocalLicense } from "./license";
import type { DeviceState } from "@/lib/license/state";

export interface LocalUser { email: string; name: string; role: string; at: number }
export interface SyncState {
  running: boolean;
  lastAt: number | null;
  error: string | null;
  pending: number;
  pushed: number;
  pulled: number;
}
export type Phase = "starting" | "need_code" | "opening" | "first_sync" | "sign_in" | "ready" | "locked" | "failed";

interface PGliteLike {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

const SESSION_MS = 12 * 3600_000;
const SYNC_EVERY_MS = 60_000;
const CHECK_EVERY_MS = 6 * 3600_000;
const REFUSED = new Set(["not_found", "other_device", "stopped", "expired"]);

export class LocalRuntime extends EventTarget {
  phase: Phase = "starting";
  failure = "";
  license: LocalLicense | null = null;
  state: DeviceState = { kind: "need" };
  blocked: string | null = null;
  user: LocalUser | null = null;
  sync: SyncState = { running: false, lastAt: null, error: null, pending: 0, pushed: 0, pulled: 0 };
  progress = "";
  client: PgRestClient | null = null;
  private pg: PGliteLike | null = null;
  private db: Db | null = null;
  private meta: FkMeta | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private soon: ReturnType<typeof setTimeout> | null = null;

  private set(phase: Phase, progress = "") {
    this.phase = phase;
    this.progress = progress;
    this.dispatchEvent(new Event("phase"));
  }
  private changed() {
    this.dispatchEvent(new Event("change"));
  }

  // ── start ──────────────────────────────────────────────────────────────
  async start(): Promise<void> {
    try {
      this.license = loadLicense();
      if (!this.license) return this.set("need_code");
      this.blocked = localStorage.getItem(`spir.local.blocked.${this.license.lid}`);
      this.state = await localState(this.license, this.blocked);
      if (this.state.kind === "locked") return this.set("locked");
      await this.open();
      this.user = this.loadSession();
      this.set(this.user ? "ready" : "sign_in");
      this.startBackground();
    } catch (e) {
      this.failure = (e as Error).message || String(e);
      this.set("failed");
    }
  }

  /** Enter the company's code: this browser takes a seat, and the database is made and filled. */
  async activate(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
    let body: Record<string, unknown> | null = null;
    try {
      const r = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, device: deviceId(), label: browserLabel(), version: "web", kind: "browser" }),
      });
      body = await r.json().catch(() => null);
    } catch {
      return { ok: false, error: "offline" };
    }
    if (!body?.ok) return { ok: false, error: String(body?.error ?? "error") };
    const license: LocalLicense = {
      lid: "", device: deviceId(), token: String(body.token), pub: body.pub as JsonWebKey,
      company: String(body.company ?? ""), until: Number(body.until ?? 0), mods: (body.mods as string[]) ?? [],
      cloud: !!body.cloud, codeHash: await hashCode(code), message: String(body.message ?? ""),
      checkedAt: Date.now(), seen: Math.max(Date.now(), Number(body.now ?? 0)),
    };
    const payload = JSON.parse(atob(license.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { lid: string };
    license.lid = payload.lid;
    saveLicense(license);
    this.license = license;
    this.blocked = null;
    try { localStorage.removeItem(`spir.local.blocked.${license.lid}`); } catch { /* ignore */ }
    this.state = await localState(license);
    try {
      await this.open();
      // The code was just entered: it opens the whole app as the administrator.
      this.signInAs({ email: "admin@spir.local", name: "المسؤول", role: "admin", at: Date.now() });
      this.set("ready");
      this.startBackground();
      return { ok: true };
    } catch (e) {
      this.failure = (e as Error).message || String(e);
      this.set("failed");
      return { ok: false, error: "error" };
    }
  }

  // ── the database ───────────────────────────────────────────────────────
  private async open(): Promise<void> {
    const l = this.license!;
    this.set("opening", "engine");
    const manifest = (await (await fetch("/spir/local.json", { cache: "no-cache" })).json()) as { pglite: string; hash: string };
    const mod = (await import(/* webpackIgnore: true */ `/pglite/${manifest.pglite}/worker/index.js`)) as {
      PGliteWorker: { create(w: Worker, o: Record<string, unknown>): Promise<PGliteLike> };
    };
    this.pg = await mod.PGliteWorker.create(new Worker("/spir/db-worker.js", { type: "module" }), {
      dataDir: `idb://spir-${l.lid}`,
    });
    const pg = this.pg;
    this.db = { query: (sql, params) => pg.query(sql, params) as never };

    const key = `spir.local.schema.${l.lid}`;
    if (localStorage.getItem(key) !== manifest.hash) {
      this.set("opening", "schema");
      const bundle = (await (await fetch("/spir/migrations.json", { cache: "no-cache" })).json()) as Migration[];
      await migrateLocal({ exec: (s) => pg.exec(s), query: (s, p) => pg.query(s, p) as never }, bundle);
      try { localStorage.setItem(key, manifest.hash); } catch { /* next start checks again */ }
    }
    this.meta = await introspect(this.db);
    this.client = new PgRestClient({
      open: async () => ({ db: this.db!, meta: this.meta! }),
      error: (e: unknown): DbError => {
        const err = plainDbError(e);
        if (err.code?.startsWith("23") && (err.constraint || err.code === "23502")) err.message = describeDbError("ar", err) ?? err.message;
        return err;
      },
      write: async (_db, run) => {
        await this.setActor();
        const r = await run();
        this.afterWrite();
        return r;
      },
    });

    // A browser with nothing yet takes the company's records before anything else.
    if (l.cloud && navigator.onLine) {
      const n = await this.db.query<{ n: number }>(`select count(*)::int as n from _spir_sync_state where last_sync_at is not null`);
      if (!n.rows[0]?.n) {
        this.set("first_sync");
        await this.syncNow();
      }
    }
    await this.refreshPending();
  }

  /** Who the audit trail names for the next change (the trigger reads app.actor). */
  async setActor(): Promise<void> {
    if (this.db && this.user) await this.db.query("select set_config('app.actor', $1, false)", [this.user.email]);
  }

  /** Call a function after a write the builder did not see (an rpc). */
  afterWrite(): void {
    this.changed();
    void this.refreshPending();
    if (this.soon) clearTimeout(this.soon);
    this.soon = setTimeout(() => void this.syncNow(), 4000);
  }

  // ── sync ───────────────────────────────────────────────────────────────
  private async post(req: CloudRequest): Promise<unknown> {
    const l = this.license!;
    const r = await fetch("/api/cloud", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...req, lid: l.lid, device: l.device, token: l.token }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = String((body as { error?: string }).error ?? r.status);
      if (r.status === 403 && REFUSED.has(err)) this.block(err);
      throw new Error(err);
    }
    return body;
  }

  async syncNow(): Promise<SyncState> {
    if (!this.db || !this.license?.cloud || this.sync.running) return this.sync;
    if (!navigator.onLine) {
      this.sync = { ...this.sync, error: "offline" };
      this.dispatchEvent(new Event("sync"));
      return this.sync;
    }
    this.sync = { ...this.sync, running: true };
    this.dispatchEvent(new Event("sync"));
    try {
      const me = (await this.db.query<{ node_id: string }>(`select node_id::text as node_id from _spir_node limit 1`)).rows[0].node_id;
      const r = await syncOnce(this.db, cloudPeer((q) => this.post(q), me));
      this.sync = { running: false, lastAt: Date.now(), error: r.ok ? null : r.error ?? "error", pending: 0, pushed: r.pushed, pulled: r.pulled };
      if (r.pulled) {
        this.meta = await introspect(this.db);
        this.changed();
      }
    } catch (e) {
      this.sync = { ...this.sync, running: false, error: (e as Error).message || "error" };
    }
    await this.refreshPending();
    this.dispatchEvent(new Event("sync"));
    return this.sync;
  }

  private async refreshPending() {
    if (!this.db) return;
    try {
      this.sync = { ...this.sync, pending: await pendingCount(this.db, "cloud") };
      this.dispatchEvent(new Event("sync"));
    } catch { /* not yet */ }
  }

  // ── the license, checked with the site now and then ───────────────────
  async checkLicense(): Promise<void> {
    const l = this.license;
    if (!l || !navigator.onLine) return;
    try {
      const r = await fetch("/api/license/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lid: l.lid, device: l.device, version: "web", kind: "browser",
          sync: { kind: l.cloud ? "hosted" : "none", at: this.sync.lastAt, pending: this.sync.pending, error: this.sync.error ?? "" },
        }),
      });
      const body = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      if (body?.ok && typeof body.token === "string") {
        Object.assign(l, {
          token: body.token, pub: body.pub, until: Number(body.until ?? l.until), mods: (body.mods as string[]) ?? l.mods,
          cloud: !!body.cloud, message: String(body.message ?? ""), checkedAt: Date.now(),
          company: String(body.company ?? l.company),
        });
        if (typeof body.now === "number") l.seen = body.now;
        saveLicense(l);
        this.state = await localState(l);
        this.dispatchEvent(new Event("license"));
      } else if ((r.status === 403 || r.status === 404) && REFUSED.has(String(body?.error))) {
        this.block(String(body?.error));
      }
    } catch { /* offline: the saved license stands */ }
  }

  private block(reason: string) {
    if (!this.license) return;
    this.blocked = reason;
    try { localStorage.setItem(`spir.local.blocked.${this.license.lid}`, reason); } catch { /* ignore */ }
    void localState(this.license, reason).then((s) => {
      this.state = s;
      if (s.kind === "locked") this.set("locked");
    });
  }

  private startBackground() {
    if (this.timer) return;
    const tick = async () => {
      if (this.license && Date.now() - this.license.checkedAt > CHECK_EVERY_MS) await this.checkLicense();
      await this.syncNow();
    };
    this.timer = setInterval(() => void tick(), SYNC_EVERY_MS);
    window.addEventListener("online", () => void tick());
    void tick();
  }

  // ── signing in, on this browser ────────────────────────────────────────
  private sessionKey() {
    return `spir.local.session.${this.license?.lid ?? ""}`;
  }
  private loadSession(): LocalUser | null {
    try {
      const u = JSON.parse(localStorage.getItem(this.sessionKey()) ?? "null") as LocalUser | null;
      return u && Date.now() - u.at < SESSION_MS ? u : null;
    } catch {
      return null;
    }
  }
  private signInAs(u: LocalUser) {
    this.user = u;
    try { localStorage.setItem(this.sessionKey(), JSON.stringify(u)); } catch { /* this visit only */ }
    this.dispatchEvent(new Event("user"));
  }

  /** The activation code opens the whole app, as on an installed computer. */
  async signInWithCode(code: string): Promise<boolean> {
    if (!this.license || (await hashCode(code)) !== this.license.codeHash) return false;
    this.signInAs({ email: "admin@spir.local", name: "المسؤول", role: "admin", at: Date.now() });
    this.set("ready");
    return true;
  }

  /** A staff account, checked against the accounts synced to this browser. */
  async signIn(email: string, password: string): Promise<boolean> {
    if (!this.client) return false;
    const { data } = await this.client.rpc("fn_verify_login", { p_email: email.trim().toLowerCase(), p_password: password });
    const row = (data as { email: string; full_name: string | null; role: string }[] | null)?.[0];
    if (!row || row.role === "customer") return false;
    this.signInAs({ email: row.email, name: row.full_name ?? row.email, role: row.role, at: Date.now() });
    this.set("ready");
    return true;
  }

  signOut() {
    this.user = null;
    try { localStorage.removeItem(this.sessionKey()); } catch { /* ignore */ }
    this.set("sign_in");
  }
}

type W = { __spirLocalRuntime?: LocalRuntime };
export function runtime(): LocalRuntime {
  const w = window as unknown as W;
  return (w.__spirLocalRuntime ??= new LocalRuntime());
}
