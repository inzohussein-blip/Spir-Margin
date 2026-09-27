"use client";

import { useEffect } from "react";

const WORKER = "/offline-sw.js";

/**
 * Installs the one service worker this app uses, and retires any other.
 *
 * `/offline-sw.js` (see its header) keeps a copy of the pages a person opens
 * and of their content-hashed code, and shows those copies — or a page that
 * retries by itself — when the server cannot be reached. Pages always come
 * from the server first; the copies are only for when it does not answer.
 *
 * Any registration that is not this worker — the retired `/sw.js` included —
 * is removed, and this one is registered.
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
