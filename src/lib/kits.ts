/**
 * Which batch of a kit goes out next, and how close it is to expiring.
 * Pure, so the tests import it as is.
 *
 * Selling a kit takes stock from its batches earliest-expiry first
 * (fn_deduct_kit_stock, migration 0076). Whoever sells should see which
 * batch that is before saving — and be warned when it expires soon, or
 * already has.
 */

export interface BatchRow {
  product_id: string;
  batch_no: string;
  expiry_date: string | null;
  qty_available: number;
  created_at: string;
}

export interface KitHint {
  batchNo: string;
  expiry: string | null;
  qty: number;
  /** Days until expiry (negative: expired); null when the batch has no date. */
  days: number | null;
  level: "ok" | "soon" | "expired";
}

/** Within this many days, a batch counts as expiring soon. */
export const SOON_DAYS = 30;

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);

export function nextBatches(rows: BatchRow[], today: string): Record<string, KitHint> {
  const sorted = rows
    .filter((r) => Number(r.qty_available) > 0)
    .sort((a, b) => {
      // Earliest expiry first, undated last, then oldest — as the deduction does.
      if (a.expiry_date && b.expiry_date && a.expiry_date !== b.expiry_date) return a.expiry_date < b.expiry_date ? -1 : 1;
      if (!!a.expiry_date !== !!b.expiry_date) return a.expiry_date ? -1 : 1;
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    });
  const out: Record<string, KitHint> = {};
  for (const r of sorted) {
    if (out[r.product_id]) continue;
    const days = r.expiry_date ? dayNumber(r.expiry_date) - dayNumber(today) : null;
    out[r.product_id] = {
      batchNo: r.batch_no,
      expiry: r.expiry_date ? r.expiry_date.slice(0, 10) : null,
      qty: Number(r.qty_available),
      days,
      level: days === null ? "ok" : days < 0 ? "expired" : days <= SOON_DAYS ? "soon" : "ok",
    };
  }
  return out;
}
