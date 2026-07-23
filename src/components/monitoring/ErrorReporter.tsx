"use client";

import { useEffect } from "react";
import { logError } from "@/app/actions/monitoring";

/**
 * Captures uncaught client errors and unhandled promise rejections and records
 * them to the error monitor, so an operator can confirm the app is healthy.
 * Identical messages are de-duplicated within a short window so a repeating
 * error never floods the log.
 */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Map<string, number>();
    const report = (message: string, detail?: string | null) => {
      const key = message.slice(0, 200);
      const now = Date.now();
      const last = seen.get(key) ?? 0;
      if (now - last < 5000) return;
      seen.set(key, now);
      void logError({
        message,
        detail: detail ?? null,
        path: typeof location !== "undefined" ? location.pathname : null,
        source: "client",
      });
    };

    const onError = (e: ErrorEvent) =>
      report(e.message || "Script error", e.error?.stack || `${e.filename ?? ""}:${e.lineno ?? ""}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      report(r?.message || String(e.reason) || "Unhandled promise rejection", r?.stack ?? null);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
