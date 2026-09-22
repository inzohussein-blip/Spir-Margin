/*
 * Spir-Margin — the smallest service worker that can help.
 *
 * The app runs from a program on this same computer, so "offline" in the usual
 * sense (no internet) changes nothing: data never leaves the machine to be
 * read. The one real failure is the program itself not answering — the app
 * window opened at boot before the service started, or the service stopped.
 * The browser then shows its own "site can't be reached" page, which tells a
 * user nothing useful.
 *
 * This worker only steps in for that case. It:
 *   - handles full page loads (mode "navigate") and nothing else — never
 *     scripts, styles, data requests or actions;
 *   - always tries the network first and caches no response;
 *   - on failure, serves one saved page that explains and retries by itself.
 *
 * An earlier worker cached app code and HTML, which is unsafe for Next.js: a
 * page and its chunks belong to one build, and after an update it could serve
 * a chunk from the previous one. Nothing here is cached except offline.html,
 * so that failure cannot happen.
 */
const CACHE = "spir-offline-v1";
const PAGE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(PAGE, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop anything older, including the caches of the retired worker.
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(PAGE)) || Response.error()),
  );
});
