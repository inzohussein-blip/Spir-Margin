"use client";

import { useEffect } from "react";
import { logError } from "@/app/actions/monitoring";

/**
 * Root error boundary (catches failures in the root layout itself). Must render
 * its own <html>/<body>. It also records the error to the monitor.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void logError({
      message: error.message || "Global application error",
      detail: `${error.digest ? `digest: ${error.digest}\n` : ""}${error.stack ?? ""}`,
      path: typeof location !== "undefined" ? location.pathname : null,
      source: "server",
    });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f4f5f8" }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: 32, borderRadius: 16, background: "#fff", boxShadow: "0 1px 3px rgba(16,24,40,.1)" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>حدث خطأ ما</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>تم تسجيل الخطأ في قائمة المراقبة.</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 20, padding: "8px 16px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: 0, fontSize: 14, cursor: "pointer" }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
