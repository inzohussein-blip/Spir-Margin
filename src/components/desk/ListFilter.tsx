"use client";

import { useRef, useState } from "react";
import { SearchIcon } from "lucide-react";

/**
 * Generic ERPNext-style list quick-filter. Filters the rows of the sibling
 * `[data-desk-list] tbody tr` by their text content — works over any table
 * markup with no per-page wiring, and keeps a live visible count.
 */
export function ListFilter({ placeholder = "Filter…" }: { placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState<number | null>(null);

  function apply(q: string) {
    const root = ref.current?.closest("[data-desk-shell]");
    const rows = root?.querySelectorAll<HTMLTableRowElement>("[data-desk-list] tbody tr");
    if (!rows) return;
    const needle = q.trim().toLowerCase();
    let shown = 0;
    rows.forEach((tr) => {
      const match = !needle || (tr.textContent ?? "").toLowerCase().includes(needle);
      tr.hidden = !match;
      if (match) shown++;
    });
    setVisible(needle ? shown : null);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-gray-4" />
        <input
          ref={ref}
          onChange={(e) => apply(e.target.value)}
          placeholder={placeholder}
          className="w-56 rounded-md border border-outline-gray-2 bg-surface-white py-1.5 pl-8 pr-3 text-sm text-ink-gray-8 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      {visible != null && <span className="text-xs text-ink-gray-4">{visible} match{visible === 1 ? "" : "es"}</span>}
    </div>
  );
}
