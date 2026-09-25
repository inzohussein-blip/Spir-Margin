"use client";

import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useRef } from "react";
import { DownloadIcon, SheetIcon } from "lucide-react";
import { localDate } from "@/lib/dates";
import { buildXlsx } from "@/lib/xlsx";

/**
 * Export the visible ListShell table — read from the rendered table, so it
 * works for every list page without per-page wiring. Columns headed "Action"
 * (in-row buttons) are skipped, and so are rows hidden by the quick filter.
 */
function readTable(from: HTMLElement | null): string[][] | null {
  const shell = from?.closest("[data-desk-shell]");
  const table = shell?.querySelector<HTMLTableElement>("[data-desk-list] table");
  if (!table) return null;
  const clean = (v: string | null) => (v ?? "").replace(/\s+/g, " ").trim();
  const headCells = Array.from(table.querySelectorAll("thead th"));
  const skip = new Set<number>();
  headCells.forEach((th, i) => {
    const h = clean(th.textContent).toLowerCase();
    if (h === "action" || h === "actions" || h === "" || h === "إجراء" || h === "إجراءات") skip.add(i);
  });
  const keep = <T,>(cells: T[]) => cells.filter((_, i) => !skip.has(i));
  const header = keep(headCells.map((th) => clean(th.textContent)));
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"))
    .filter((tr) => !tr.hidden)
    .map((tr) => keep(Array.from(tr.querySelectorAll("td")).map((td) => clean(td.textContent))));
  return [header, ...rows];
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // In the page, or some browsers ignore the file name and save "download".
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileBase = (title: string) => `${title.replace(/\s+/g, "-").toLowerCase()}-${localDate()}`;

export function ExportCsvButton({ title, label = "Export" }: { title: string; label?: string }) {
  const locale = useLocale();
  const ref = useRef<HTMLButtonElement>(null);

  const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  function onCsv() {
    const table = readTable(ref.current);
    if (!table) return;
    const csv = table.map((row) => row.map(csvCell).join(",")).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), `${fileBase(title)}.csv`);
  }

  function onExcel() {
    const table = readTable(ref.current);
    if (!table) return;
    const data = buildXlsx(title, table, { rtl: true });
    download(
      new Blob([new Uint8Array(data)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${fileBase(title)}.xlsx`,
    );
  }

  const cls =
    "inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-2.5 py-1.5 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1";
  return (
    <>
      <button type="button" onClick={onExcel} title={t(locale, "Export to Excel")} data-export="xlsx" className={cls}>
        <SheetIcon size={14} /> <span className="hidden sm:inline">{t(locale, "Excel")}</span>
      </button>
      <button ref={ref} type="button" onClick={onCsv} title={t(locale, "Export to CSV")} data-export="csv" className={cls}>
        <DownloadIcon size={14} /> <span className="hidden sm:inline">{label}</span>
      </button>
    </>
  );
}
