"use client";

import { useEffect } from "react";
import { RefreshCwIcon, AlertTriangleIcon } from "lucide-react";
import { logError } from "@/app/actions/monitoring";

/**
 * Segment error boundary: shows a friendly recovery screen and records the
 * error to the monitor so it shows up in /monitoring/errors.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void logError({
      message: error.message || "Application error",
      detail: `${error.digest ? `digest: ${error.digest}\n` : ""}${error.stack ?? ""}`,
      path: typeof location !== "undefined" ? location.pathname : null,
      source: error.digest ? "server" : "client",
    });
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-outline-gray-2 bg-surface-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangleIcon size={26} />
      </span>
      <h1 className="text-lg font-bold text-ink-gray-8">حدث خطأ ما</h1>
      <p className="mt-1.5 text-sm text-ink-gray-5">تم تسجيل الخطأ تلقائياً في قائمة المراقبة. يمكنك المحاولة مجدداً.</p>
      <button
        onClick={() => reset()}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:bg-brand-dark active:translate-y-0"
      >
        <RefreshCwIcon size={15} /> إعادة المحاولة
      </button>
    </div>
  );
}
