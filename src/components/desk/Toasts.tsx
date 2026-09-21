"use client";

import { Suspense } from "react";
import { Toaster } from "sonner";
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { SaveToast } from "./SaveToast";

/**
 * App-wide toast host.
 *
 * Deliberately not `@/components/ui/sonner` — that one pulls a theme provider
 * this app does not mount. This is light-theme, right-aligned to match the
 * RTL layout, and carries the toast reader for post-save confirmations.
 *
 * SaveToast reads searchParams, so it must sit inside Suspense or it would
 * opt every page into client-side rendering.
 */
export function Toasts() {
  return (
    <>
      <Toaster
        position="bottom-left"
        dir="rtl"
        theme="light"
        closeButton
        richColors
        toastOptions={{ style: { fontFamily: "inherit" } }}
        icons={{
          success: <CircleCheckIcon className="size-4" />,
          info: <InfoIcon className="size-4" />,
          warning: <TriangleAlertIcon className="size-4" />,
          error: <OctagonXIcon className="size-4" />,
        }}
      />
      <Suspense fallback={null}>
        <SaveToast />
      </Suspense>
    </>
  );
}
