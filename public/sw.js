/**
 * Spir-Margin service worker — offline app shell.
 *
 * Strategy:
 *   - Precache the sign-in / welcome pages, the manifest, and the app icon so
 *     the local build can bring the UI up with no network at all.
 *   - Runtime-cache GET requests for the app's static assets under `/_next/`
 *     (JS chunks, CSS, images) with a cache-first policy so page navigations
 *     after the first load do not require the network.
 *   - All other GETs (including HTML pages) use network-first with a cached
 *     fallback so the freshest version wins when online, but any previously
 *     visited page still opens offline.
 *   - Never intercept POST / PUT / DELETE — server actions must always hit
 *     the server to have any effect.
 */

const VERSION = "spir-1";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  "/",
  "/login",
  "/welcome",
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL);
      // Best-effort precache — a single 404 on install must not fail the SW.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {
            /* offline install — cache what we can on the first online visit */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== APP_SHELL && k !== RUNTIME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs from the same origin. Everything else — server actions,
  // API POSTs, cross-origin fetches — passes straight through.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first, then fill.
  if (url.pathname.startsWith("/_next/") || url.pathname === "/icon.svg") {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else (HTML documents, JSON, etc.): network-first, cache fallback.
  event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // Absolute fallback — return a synthetic 504 rather than throwing.
    return new Response("", { status: 504, statusText: "offline" });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res.ok && (req.destination === "document" || res.headers.get("content-type")?.includes("text/html"))) {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    const shell = await caches.open(APP_SHELL);
    // For a navigation, fall back to the login shell — the best we can offer.
    if (req.mode === "navigate") {
      const login = await shell.match("/login");
      if (login) return login;
    }
    return new Response("", { status: 504, statusText: "offline" });
  }
}
