"use client";

import { useEffect } from "react";

/**
 * Removes any service worker this app previously installed, and drops its
 * caches.
 *
 * An earlier build shipped `/sw.js`, which cached `/_next/*` and whole HTML
 * documents. That is unsafe for the Next.js App Router: a page's HTML, its
 * RSC flight payloads and its JS chunks are keyed to one build ID, so after
 * a redeploy the worker could answer with a chunk from the previous build.
 * The browser then rejects the stale chunk (observed as a 400 on
 * /_next/static/chunks/app/page-*.js), the client navigation collapses and
 * the user lands in the error boundary — which is exactly the
 * "حدث خطأ ما" screen reported right after signing in.
 *
 * Offline support does not need a worker here. The local trial serves
 * everything from a Node process on the same machine, so there is no network
 * to lose; the cloud build is inherently online. Rather than ship a
 * carefully-tuned worker for no gain, unregister it and clear the caches so
 * anyone who already installed the old one recovers on their next visit.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys.filter((k) => k.startsWith("spir-")).map((k) => caches.delete(k)),
          );
        }
      } catch {
        /* best-effort cleanup; the app must work regardless */
      }
    })();
  }, []);

  return null;
}
