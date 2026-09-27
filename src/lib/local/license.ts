/**
 * The web version's license, kept in this browser and checked here, offline:
 * the signature (ES256, the codes server's key) with the browser's own
 * WebCrypto, then the same judgement an installed computer makes
 * (state.ts: the period, the offline limit, the clock turned back).
 */
import { judge, type DeviceState, type Payload } from "@/lib/license/state";

export interface LocalLicense {
  lid: string;
  device: string;
  token: string;
  pub: JsonWebKey;
  company: string;
  until: number;
  mods: string[];
  /** The code carries a company database: sync through the site. */
  cloud: boolean;
  /** A fingerprint of the code (never the code): signing in with it opens the whole app. */
  codeHash: string;
  message?: string;
  /** Computers (browsers) the code allows, and whether it is a trial. */
  seats?: number;
  trial?: boolean;
  checkedAt: number;
  seen: number;
}

/** What the site's owner has switched on for the web app (GET /api/license), kept for offline opens. */
export interface SiteInfo { enabled: boolean; contact: string; signup: boolean; errorLog: boolean; warnDays: number }
const SITE_KEY = "spir.local.site";
export function loadSite(): SiteInfo {
  try {
    const s = JSON.parse(localStorage.getItem(SITE_KEY) ?? "null") as Partial<SiteInfo> | null;
    return { enabled: s?.enabled !== false, contact: s?.contact ?? "", signup: !!s?.signup, errorLog: !!s?.errorLog, warnDays: s?.warnDays ?? 14 };
  } catch {
    return { enabled: true, contact: "", signup: false, errorLog: false, warnDays: 14 };
  }
}
export function saveSite(s: SiteInfo): void {
  try { localStorage.setItem(SITE_KEY, JSON.stringify(s)); } catch { /* this visit only */ }
}

const KEY = "spir.local.license";
const DEVICE_KEY = "spir.local.device";

export function loadLicense(): LocalLicense | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalLicense) : null;
  } catch {
    return null;
  }
}
export function saveLicense(l: LocalLicense | null): void {
  try {
    if (l) localStorage.setItem(KEY, JSON.stringify(l));
    else localStorage.removeItem(KEY);
  } catch { /* storage refused: the license lives for this visit */ }
}

/** This browser's id, made once. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

export function browserLabel(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [`تطبيق الويب${br ? ` · ${br}` : ""}`, os].filter(Boolean).join(" · ").slice(0, 160);
}

const b64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

/** The payload when the signature is genuine; null otherwise. */
export async function verifyToken(token: string, pub: JsonWebKey): Promise<Payload | null> {
  try {
    const [h, b, s] = token.split(".");
    if (!h || !b || !s) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64u(s), new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(b64u(b))) as Payload;
  } catch {
    return null;
  }
}

/** The same fingerprint the codes server and the installed computers keep. */
export async function hashCode(code: string): Promise<string> {
  const norm = String(code ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("spir-code:" + norm));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Where this browser stands, offline. */
export async function localState(l: LocalLicense | null, blocked: string | null = null): Promise<DeviceState> {
  if (!l) return { kind: "need" };
  const payload = await verifyToken(l.token, l.pub);
  const now = Date.now();
  if (now > l.seen) {
    l.seen = now;
    saveLicense(l);
  }
  return judge({
    hasServer: true, enabled: true, payload, deviceId: l.device, blocked,
    now, seen: l.seen, legacy: false, graceStart: null,
  });
}
