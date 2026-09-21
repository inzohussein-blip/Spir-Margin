"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` on the client. Rendered once by the root layout.
 * Kept intentionally tiny so it can run on every page load without cost.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production — during `next dev` the SW would cache
    // stale bundles and mask code changes.
    if (process.env.NODE_ENV !== "production") return;

    const controller = new AbortController();
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          /* SW registration is best-effort; app must work without it too. */
        });
      },
      { once: true, signal: controller.signal },
    );
    return () => controller.abort();
  }, []);
  return null;
}
