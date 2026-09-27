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
 */
const OFFLINE = "spir-offline-v2";
const PAGES = "spir-pages-v2";
const ASSETS = "spir-assets-v2";
const PAGE = "/offline.html";
const MAX_PAGES = 80;
const MAX_ASSETS = 500;
const KEEP = new Set([OFFLINE, PAGES, ASSETS]);

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
      for (const key of await caches.keys()) if (!KEEP.has(key)) await caches.delete(key);
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
    } else if (who && res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
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
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    cache.put(request, res.clone());
    trim(ASSETS, MAX_ASSETS);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(page(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) event.respondWith(asset(request));
});
