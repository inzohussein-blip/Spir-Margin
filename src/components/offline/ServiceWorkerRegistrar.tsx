"use client";

import { useEffect } from "react";

const WORKER = "/offline-sw.js";

/**
 * Installs the one service worker this app uses, and retires any other.
 *
 * `/offline-sw.js` does a single job: when the program on this computer does
 * not answer a full page load, it shows a page that explains and retries on
 * its own, instead of the browser's "site can't be reached". It caches no app
 * code, which is what made the earlier `/sw.js` unsafe: that one cached
 * `/_next/*` and HTML, so after an update it could answer with a chunk from
 * the previous build, the browser rejected it, and the user landed on the
 * error screen right after signing in.
 *
 * So any registration that is not this worker — `/sw.js` included — is
 * removed, and this one is registered.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs
            .filter((r) => {
              const url = (r.active ?? r.waiting ?? r.installing)?.scriptURL ?? "";
              return !url.endsWith(WORKER);
            })
            .map((r) => r.unregister().catch(() => false)),
        );
        await navigator.serviceWorker.register(WORKER, { scope: "/" });
      } catch {
        /* best effort; the app works the same without it */
      }
    })();
  }, []);

  return null;
}
