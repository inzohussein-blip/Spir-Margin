"use client";

import { useEffect } from "react";

/**
 * Copies each list table's column headers onto its body cells as
 * `data-label`, so the CSS in globals.css can render every row as a labelled
 * card below the `md` breakpoint.
 *
 * Why at runtime rather than in each page: there are 60+ list pages, each
 * writing its own `<table>`. Threading a label through every `<td>` would
 * touch all of them and drift the moment someone adds a column. Reading the
 * `<th>` text is always correct by construction.
 *
 * Progressive: with JS off (or before this runs) the table keeps its normal
 * scrollable layout, which still works — the card layout is an enhancement,
 * never a prerequisite for reading the data.
 */
export function ResponsiveTableLabels() {
  useEffect(() => {
    const label = (root: ParentNode) => {
      root.querySelectorAll<HTMLTableElement>("[data-desk-list] table").forEach((table) => {
        const heads = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(
          (th) => th.textContent?.trim() ?? "",
        );
        if (!heads.length) return;
        table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
          Array.from(tr.cells).forEach((td, i) => {
            const text = heads[i];
            if (text) td.setAttribute("data-label", text);
          });
        });
        table.setAttribute("data-labelled", "");
      });
    };

    label(document);

    // List pages re-render on filter/sort/pagination, which replaces the rows.
    const mo = new MutationObserver(() => label(document));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return null;
}
