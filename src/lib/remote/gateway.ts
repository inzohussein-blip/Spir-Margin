import "server-only";
import http from "node:http";
import { getDb } from "@/lib/db/pglite";
import { t } from "@/lib/i18n";
import {
  AttemptLimiter, DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, newToken, normalizePairCode, ownAddressToPath, readDeviceCookie,
  sha256, withoutDeviceCookie,
} from "./tokens";

/**
 * The remote-access gateway (migration 0113).
 *
 * The program itself listens on 127.0.0.1 only. When an administrator turns
 * remote access on, this listener opens a port of its own on every network
 * the computer is on and passes requests through to the program, with two
 * additions:
 *
 *   - every request it passes is marked `x-spir-remote: 1` (whatever the
 *     browser sent under that name is dropped first), so the program knows
 *     it did not come from the keyboard of this computer — the built-in
 *     account, whose password is printed on the sign-in page until changed,
 *     is refused on such requests;
 *   - unless switched off, a browser must be paired before it sees anything,
 *     sign-in page included: an administrator makes a one-time code on this
 *     computer, it is typed once on the other device, and that device then
 *     carries a token of its own (see tokens.ts). Cutting one device off
 *     leaves the others alone.
 *
 * Turned on and off, and its port changed, without restarting the program.
 */

export const DEFAULT_GATEWAY_PORT = 3300;
const DEVICE_CACHE_MS = 30_000;

export interface GatewaySetting {
  enabled: boolean;
  port: number;
  requireDevice: boolean;
}

interface Running {
  server: http.Server;
  port: number;
  requireDevice: boolean;
  error: string | null;
}

const G = globalThis as unknown as {
  __spirGateway?: Running | null;
  __spirDeviceCache?: Map<string, { id: string | null; at: number }>;
  __spirPairLimiter?: AttemptLimiter;
};
const deviceCache = () => (G.__spirDeviceCache ??= new Map());
const limiter = () => (G.__spirPairLimiter ??= new AttemptLimiter());

/** After a device is cut off: forget every answer given, so it takes effect now. */
export function forgetDevices(): void {
  deviceCache().clear();
}

export async function readGatewaySetting(): Promise<GatewaySetting> {
  const { db } = await getDb();
  const r = await db.query<{ enabled: boolean; port: number; require_device: boolean }>(
    `select enabled, port, require_device from _spir_gateway`,
  );
  const x = r.rows[0];
  return {
    enabled: !!x?.enabled,
    port: Number(x?.port ?? DEFAULT_GATEWAY_PORT),
    requireDevice: x?.require_device ?? true,
  };
}

export function gatewayState(): { running: boolean; port: number | null; error: string | null } {
  const r = G.__spirGateway;
  return { running: !!r && r.server.listening, port: r?.port ?? null, error: r?.error ?? null };
}

/** The port the program itself answers on, on 127.0.0.1. */
function appPort(): number {
  const p = Number(process.env.PORT);
  return Number.isInteger(p) && p > 0 ? p : 3000;
}

// ------------------------------------------------------------------ devices

/** The paired browser behind this Cookie header, or null. */
async function deviceOf(cookieHeader: string | undefined, address: string): Promise<string | null> {
  const c = readDeviceCookie(cookieHeader);
  if (!c) return null;
  const key = `${c.id}.${c.token}`;
  const hit = deviceCache().get(key);
  if (hit && Date.now() - hit.at < DEVICE_CACHE_MS) return hit.id;
  const { db } = await getDb();
  const r = await db.query<{ id: string }>(
    `update _spir_devices set last_seen_at = now(), last_address = $3
      where id = $1::uuid and kind = 'browser' and revoked_at is null and token_hash = $2
      returning id`,
    [c.id, sha256(c.token), address.slice(0, 80)],
  );
  const id = r.rows[0]?.id ?? null;
  deviceCache().set(key, { id, at: Date.now() });
  return id;
}

/** Trade a pairing code for a device token. Returns the cookie value, or null. */
async function pair(code: string, address: string): Promise<string | null> {
  const digits = normalizePairCode(code);
  if (digits.length !== 8) return null;
  const token = newToken();
  const { db } = await getDb();
  const r = await db.query<{ id: string }>(
    `update _spir_devices
        set token_hash = $2, pair_hash = null, pair_expires_at = null, last_seen_at = now(), last_address = $3
      where kind = 'browser' and revoked_at is null and pair_hash = $1 and pair_expires_at > now()
      returning id`,
    [sha256(digits), sha256(token), address.slice(0, 80)],
  );
  const id = r.rows[0]?.id;
  return id ? `${id}.${token}` : null;
}

// ------------------------------------------------------------------ the pairing page

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pairingPage(error: string | null): string {
  const L = (k: string) => esc(t("ar", k));
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spir-Margin</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f5f7;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:#1f2937}
  main{width:min(420px,calc(100% - 32px));background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
  h1{font-size:20px;margin:0 0 8px}
  p{font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 16px}
  input{width:100%;box-sizing:border-box;font-size:24px;letter-spacing:4px;text-align:center;padding:12px;border:1px solid #d1d5db;border-radius:10px;direction:ltr}
  button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
  .err{background:#fef2f2;color:#b91c1c;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:14px}
</style></head>
<body><main>
  <h1>${L("Pair this device")}</h1>
  <p>${L("This program is on another computer. Before it opens here, an administrator there must allow this device: on that computer, open Sync, then Remote access, add a device, and type here the code it shows.")}</p>
  ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
  <form method="post" action="/__spir/pair">
    <input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="1234-5678" required autofocus>
    <button type="submit">${L("Pair")}</button>
  </form>
</main></body></html>`;
}

function send(res: http.ServerResponse, status: number, html: string, extra: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(html);
}

async function readForm(req: http.IncomingMessage): Promise<URLSearchParams> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) break;
  }
  return new URLSearchParams(body);
}

// ------------------------------------------------------------------ passing requests through

const HOP = ["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer"];

function passThrough(req: http.IncomingMessage, res: http.ServerResponse, device: string | null, address: string) {
  const headers: http.OutgoingHttpHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || HOP.includes(k) || k.startsWith("x-spir-")) continue;
    headers[k] = v;
  }
  const cookie = withoutDeviceCookie(req.headers.cookie);
  if (cookie) headers.cookie = cookie;
  else delete headers.cookie;
  headers["x-spir-remote"] = "1";
  if (device) headers["x-spir-device"] = device;
  headers["x-forwarded-for"] = address;
  headers["x-forwarded-proto"] = "http";
  if (req.headers.host) headers["x-forwarded-host"] = req.headers.host;

  const up = http.request(
    { host: "127.0.0.1", port: appPort(), method: req.method, path: req.url, headers },
    (r) => {
      const out: http.OutgoingHttpHeaders = {};
      for (const [k, v] of Object.entries(r.headers)) if (v !== undefined && !HOP.includes(k)) out[k] = v;
      // The program names itself by its own address (localhost:3000) in
      // redirects; from the other device that address is this device's own.
      if (typeof out.location === "string") out.location = ownAddressToPath(out.location, appPort());
      res.writeHead(r.statusCode ?? 502, out);
      r.pipe(res);
    },
  );
  up.on("error", () => {
    if (!res.headersSent) send(res, 502, pairingShell(t("ar", "The program is starting on the main computer. Try again in a minute.")));
    else res.end();
  });
  req.pipe(up);
}

function pairingShell(message: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Spir-Margin</title></head>
<body style="font-family:system-ui,Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f5f7">
<p style="background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e7eb">${esc(message)}</p></body></html>`;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse, state: Running) {
  const address = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  const path = (req.url ?? "/").split("?")[0];

  if (path === "/__spir/pair") {
    if (req.method === "POST") {
      if (!limiter().allow(address)) {
        send(res, 429, pairingPage(t("ar", "Too many attempts. Try again later.")));
        return;
      }
      const form = await readForm(req);
      const cookie = await pair(String(form.get("code") ?? ""), address);
      if (!cookie) {
        send(res, 403, pairingPage(t("ar", "That code is not right, or it has expired. Ask for a new one.")));
        return;
      }
      res.writeHead(303, {
        location: "/",
        "set-cookie": `${DEVICE_COOKIE}=${encodeURIComponent(cookie)}; Path=/; Max-Age=${DEVICE_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`,
        "cache-control": "no-store",
      });
      res.end();
      return;
    }
    if (state.requireDevice && (await deviceOf(req.headers.cookie, address))) {
      res.writeHead(303, { location: "/" }).end();
      return;
    }
    send(res, 200, pairingPage(null));
    return;
  }

  let device: string | null = null;
  if (state.requireDevice) {
    device = await deviceOf(req.headers.cookie, address);
    if (!device) {
      if (req.method === "GET" || req.method === "HEAD") res.writeHead(303, { location: "/__spir/pair" }).end();
      else res.writeHead(401).end();
      return;
    }
  }
  passThrough(req, res, device, address);
}

function start(port: number, requireDevice: boolean): Promise<void> {
  return new Promise((resolve) => {
    const state: Running = { server: http.createServer(), port, requireDevice, error: null };
    state.server.on("request", (req, res) => {
      handle(req, res, G.__spirGateway ?? state).catch((e) => {
        console.error("[gateway]", (e as Error).message);
        if (!res.headersSent) res.writeHead(500).end();
      });
    });
    G.__spirGateway = state;
    state.server.once("error", (e: NodeJS.ErrnoException) => {
      state.error = e.code === "EADDRINUSE" ? `port ${port} is in use` : e.message;
      console.error("[gateway] could not listen:", state.error);
      resolve();
    });
    state.server.listen(port, "0.0.0.0", () => resolve());
  });
}

async function stop(): Promise<void> {
  const r = G.__spirGateway;
  G.__spirGateway = null;
  if (r?.server.listening) {
    r.server.closeAllConnections?.();
    await new Promise<void>((done) => r.server.close(() => done()));
  }
}

/** Make the gateway match the saved setting: start, stop, or restart it. */
export async function applyGatewaySetting(): Promise<void> {
  const s = await readGatewaySetting();
  const r = G.__spirGateway;
  if (!s.enabled) {
    await stop();
    return;
  }
  if (r && r.server.listening && r.port === s.port) {
    r.requireDevice = s.requireDevice;
    return;
  }
  await stop();
  await start(s.port, s.requireDevice);
}
