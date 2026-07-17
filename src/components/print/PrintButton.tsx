"use client";

import { PrinterIcon } from "lucide-react";

/** Triggers the browser print dialog (which offers "Save as PDF"). Hidden in print output. */
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
    >
      <PrinterIcon size={15} /> {label}
    </button>
  );
}
