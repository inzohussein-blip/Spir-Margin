/*
 * Spir-Margin — the offline worker.
 *
 * Two situations leave a page unable to reach its server: the program on
 * this computer is not running (the window opened before the service, or it
 * stopped), or — on the web version — the internet is gone. Either way the
 * browser would show its own "site can't be reached" page.
 *
 * This worker keeps a copy of each page a person opens, and of the code those
 * pages need, so that without a connection:
 *   - a page opened before is shown again as it was last seen (the app shows
 *     a bar saying so: nothing on it is fresh), and a sale or sales order made
 *     there waits in the browser's outbox until the server answers;
 *   - a page never opened shows /offline.html, which retries by itself.
 *
 * What makes this safe (an earlier worker was not):
 *   - pages are always asked of the server first; the copy is used only when
 *     the server cannot be reached, never instead of it;
 *   - code is cached only from /_next/static/, whose file names carry a hash
 *     of their contents: a name never means two different files, so a copy
 *     can never mix two builds;
 *   - copies of pages belong to the person they were made for (the
 *     `x-spir-user` header the middleware adds): another person signing in on
 *     this browser, or signing out, drops them;
 *   - only full page loads and static code are touched — never data
 *     requests, form posts or server actions.
 *
 * The web app (/app) is different: it is one page holding the company's
 * database in the browser, meant to open without the internet at all. On its
 * first online open the page asks this worker to "prepare": the whole app —
 * the page, every script and style it names, the database engine
 * (/pglite/<version>/) and the schema files (/spir/) — is downloaded once into
 * one versioned cache (spir-app-<version>), with progress sent to the page.
 * The version is a hash of what the page names, so a new release is a new
 * cache: it is downloaded in the background while the old one keeps working,
 * then switched in whole (never a mix of two releases), and the page is told
 * an update is ready. Its page holds no one's data, so it is kept for anyone.
 */
const OFFLINE = "spir-offline-v2";
const PAGES = "spir-pages-v2";
const ASSETS = "spir-assets-v2";
const PAGE = "/offline.html";
const MAX_PAGES = 80;
const MAX_ASSETS = 500;
const APP_META = "spir-app-meta";
const APP_PREFIX = "spir-app-";
const KEEP = new Set([OFFLINE, PAGES, ASSETS, APP_META]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE)
      .then((cache) => cache.add(new Request(PAGE, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const meta = await appMeta();
      for (const key of await caches.keys()) if (!KEEP.has(key) && key !== meta?.cache) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Keep a cache from growing without bound: the oldest entries go first. */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Whose pages are kept (the last signed-in person seen). */
let owner = null;
async function ownerOf() {
  if (owner !== null) return owner;
  const hit = await (await caches.open(OFFLINE)).match("/__spir-owner");
  owner = hit ? await hit.text() : "";
  return owner;
}
async function setOwner(id) {
  owner = id;
  await (await caches.open(OFFLINE)).put("/__spir-owner", new Response(id));
}

async function page(request) {
  const url = new URL(request.url);
  const key = url.origin + url.pathname + url.search;
  try {
    const res = await fetch(request);
    const who = res.headers.get("x-spir-user");
    if (who === "0") {
      // Nobody signed in: no one's pages stay on this browser.
      await caches.delete(PAGES);
      await setOwner("");
    } else if (who && who !== "shell" && res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
      if (who !== (await ownerOf())) {
        await caches.delete(PAGES);
        await setOwner(who);
      }
      const cache = await caches.open(PAGES);
      await cache.put(key, res.clone());
      trim(PAGES, MAX_PAGES);
    }
    return res;
  } catch {
    const kept = await (await caches.open(PAGES)).match(key);
    if (kept) return kept;
    return (await caches.match(PAGE)) || Response.error();
  }
}

async function asset(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    (await caches.open(ASSETS)).put(request, res.clone());
    trim(ASSETS, MAX_ASSETS);
  }
  return res;
}

// ── The web app (/app) ───────────────────────────────────────────────────
let metaMemo;
async function appMeta() {
  if (metaMemo !== undefined) return metaMemo;
  try {
    const r = await (await caches.open(APP_META)).match("/__spir-app");
    metaMemo = r ? await r.json() : null;
  } catch { metaMemo = null; }
  if (metaMemo && !(await caches.has(metaMemo.cache))) metaMemo = null;
  return metaMemo;
}
async function setAppMeta(m) {
  metaMemo = m;
  await (await caches.open(APP_META)).put("/__spir-app", new Response(JSON.stringify(m), { headers: { "content-type": "application/json" } }));
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/** The app's page: the server's (a release shows at once), or the kept copy when it does not answer soon. */
async function appPage(request) {
  const meta = await appMeta();
  const kept = meta ? await (await caches.open(meta.cache)).match("/app") : undefined;
  if (!(self.navigator && self.navigator.onLine === false)) {
    try {
      const res = await withTimeout(fetch(request), kept ? 4000 : 30000);
      if (res.ok || !kept) return res;
    } catch { /* no answer: the kept copy */ }
  }
  if (kept) return kept;
  try { return await fetch(request); } catch { return (await caches.match(PAGE)) || Response.error(); }
}

/** A file of the app that may change between releases (/spir/…): the server's, else the kept one. */
async function appFile(request) {
  try {
    const res = await withTimeout(fetch(request), 8000);
    if (res.ok) return res;
  } catch { /* offline */ }
  return (await caches.match(request, { ignoreSearch: true })) || Response.error();
}

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
const staticRefs = (text) => [...text.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)].map((m) => m[0].replace(/\\$/, ""));

/** Download the whole app once (or a new release), then switch to it. */
async function prepare(tell) {
  const meta = await appMeta();
  let html, local;
  try {
    const res = await fetch("/app", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok || res.redirected) throw new Error("status " + res.status);
    html = await res.text();
    local = await (await fetch("/spir/local.json", { cache: "no-store" })).json();
  } catch {
    return { status: meta ? "ready" : "offline", at: meta?.at ?? null };
  }
  const scripts = [...new Set(staticRefs(html))].sort();
  const version = await sha(scripts.join("|") + "|" + local.pglite + "|" + local.hash);
  if (meta && meta.version === version) return { status: "ready", at: meta.at, version };

  const name = APP_PREFIX + version;
  const cache = await caches.open(name);
  const files = [...(local.files || []), "/spir/local.json", "/spir/migrations.json", "/spir/db-worker.js", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"];
  const queue = [...scripts];
  const seen = new Set(queue);
  const total = () => files.length + queue.length + 1;
  let done = 0;
  const step = () => { done++; if (!meta) tell({ status: "progress", done, total: total() }); };
  const put = async (key, res) => {
    const body = await res.blob();
    await cache.put(key, new Response(body, { status: 200, headers: { "content-type": res.headers.get("content-type") || "application/octet-stream" } }));
  };
  try {
    await put("/app", new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
    step();
    for (const f of files) {
      // The engine's path carries its version: a copy already kept is the same file.
      const have = f.startsWith("/pglite/") ? await caches.match(f) : undefined;
      const res = have || (await fetch(f, { cache: "no-store" }));
      if (!res.ok) throw new Error(f + " → " + res.status);
      await put(f, res);
      step();
    }
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i];
      const res = (await caches.match(u)) || (await fetch(u));
      if (!res.ok) throw new Error(u + " → " + res.status);
      // Scripts and styles name further files (lazy chunks, fonts): keep those too.
      if (/\.(js|css)$/.test(u)) {
        const text = await res.clone().text();
        for (const r of staticRefs(text)) if (!seen.has(r)) { seen.add(r); queue.push(r); }
      }
      await put(u, res);
      step();
    }
  } catch (e) {
    await caches.delete(name);
    return { status: "error", error: String((e && e.message) || e) };
  }
  const at = Date.now();
  await setAppMeta({ version, cache: name, at });
  for (const key of await caches.keys()) if (key.startsWith(APP_PREFIX) && key !== name) await caches.delete(key);
  return { status: meta ? "updated" : "installed", at, version, scripts };
}

let preparing = null;
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "spir-prepare") return;
  const source = event.source;
  const tell = (msg) => { try { source && source.postMessage({ type: "spir-app", ...msg }); } catch { /* page gone */ } };
  preparing = preparing || prepare(tell).finally(() => { preparing = null; });
  event.waitUntil(preparing.then(tell, (e) => tell({ status: "error", error: String((e && e.message) || e) })));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(url.pathname === "/app" ? appPage(request) : page(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pglite/")) event.respondWith(asset(request));
  else if (url.pathname.startsWith("/spir/")) event.respondWith(appFile(request));
});
