"use client";

import { useRef } from "react";
import { DownloadIcon } from "lucide-react";

/**
 * Exports the visible ListShell table to CSV — reads the rendered table so it
 * works for every list page without per-page wiring. Columns headed "Action"
 * (in-row buttons) are skipped.
 */
export function ExportCsvButton({ title }: { title: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  function csvCell(v: string) {
    const s = v.replace(/\s+/g, " ").trim();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function onExport() {
    const shell = ref.current?.closest("[data-desk-shell]");
    const table = shell?.querySelector<HTMLTableElement>("[data-desk-list] table");
    if (!table) return;

    const headCells = Array.from(table.querySelectorAll("thead th"));
    const skip = new Set<number>();
    headCells.forEach((th, i) => {
      const t = (th.textContent ?? "").trim().toLowerCase();
      if (t === "action" || t === "actions" || t === "") skip.add(i);
    });

    const header = headCells.map((th, i) => (skip.has(i) ? null : csvCell(th.textContent ?? ""))).filter((x) => x !== null);
    const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td"))
        .map((td, i) => (skip.has(i) ? null : csvCell(td.textContent ?? "")))
        .filter((x) => x !== null)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onExport}
      title="Export to CSV"
      className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-2.5 py-1.5 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1"
    >
      <DownloadIcon size={14} /> <span className="hidden sm:inline">Export</span>
    </button>
  );
}
