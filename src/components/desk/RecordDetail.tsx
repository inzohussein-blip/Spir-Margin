import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/pglite";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { t, type Locale } from "@/lib/i18n";

/**
 * Generic record detail (ERPNext "form view", read mode) for any table with a
 * uuid `id`. It introspects columns from the live schema and the app's FK
 * metadata, so a per-doctype page is a one-line wrapper. It renders a header
 * (title + status indicator + back link), a Details panel of every scalar
 * field (foreign keys resolved to a labelled link when the target has a page),
 * and any line-item child tables that reference this record.
 */

const HIDDEN = new Set(["id", "created_at", "updated_at", "password_hash", "search_tsv"]);

// Preferred human-readable column on a referenced/related row, best first.
const LABEL_COLS = [
  "name", "title", "full_name", "label",
  "invoice_no", "order_no", "receipt_no", "pick_no", "trip_no", "entry_no",
  "movement_no", "request_no", "quotation_no", "contract_no", "schedule_no",
  "visit_no", "claim_no", "bundle_no", "inspection_no", "repair_no", "appointment_no",
  "asset_code", "item_code", "serial_no", "code", "no", "reference_no", "email",
];

// Tables that have a detail page, so FK links / child rows can deep-link.
const ROUTE: Record<string, string> = {
  labs: "/labs", companies: "/companies", products: "/products", devices: "/devices",
  warehouses: "/warehouses", sales_orders: "/sales-orders", sales_invoices: "/sales-invoices",
  purchase_orders: "/purchase-orders", purchase_invoices: "/purchases",
  purchase_receipts: "/purchase-receipts", delivery_notes: "/delivery-notes",
  delivery_trips: "/delivery-trips", pick_lists: "/pick-lists", blanket_orders: "/blanket-orders",
  material_requests: "/material-requests", supplier_quotations: "/supplier-quotations",
  quotations: "/quotations", rfqs: "/rfqs", stock_entries: "/stock-entries",
  asset_movements: "/asset-movements", asset_repairs: "/asset-repairs",
  installation_notes: "/installation-notes", maintenance_visits: "/maintenance-visits",
  maintenance_schedules: "/maintenance-schedules", maintenance_teams: "/maintenance-teams",
  contracts: "/contracts", warranty_claims: "/warranty", serial_numbers: "/serials",
  appointments: "/appointments", leads: "/leads", opportunities: "/opportunities",
  journal_entries: "/journal-entries", payment_requests: "/payment-requests",
  quality_inspections: "/quality-inspections", product_bundles: "/product-bundles",
  cost_centers: "/cost-centers", accounts: "/accounts", issues: "/issues",
};

function humanize(col: string): string {
  const base = col.replace(/_id$/, "").replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  return String(v);
}

interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

async function labelFor(db: Db, cols: Set<string> | undefined, table: string, id: string): Promise<string> {
  const col = LABEL_COLS.find((c) => cols?.has(c));
  if (!col) return id.slice(0, 8);
  const r = await db.query<Record<string, unknown>>(`select ${col} from "${table}" where id = $1`, [id]);
  return (r.rows[0]?.[col] as string) ?? id.slice(0, 8);
}

export async function RecordDetail({
  table,
  id,
  listHref,
  listLabel,
}: {
  table: string;
  id: string;
  listHref: string;
  listLabel: string;
}) {
  const locale = getLocale() as Locale;
  const { db, meta } = await getDb();

  const rec = (await db.query<Record<string, unknown>>(`select * from "${table}" where id = $1`, [id])).rows[0];
  if (!rec) notFound();

  const outgoing = meta.outgoing[table] ?? [];
  const fkByCol = new Map(outgoing.map((o) => [o.column, o.ftable]));

  // Title / subtitle from the record's own best label columns.
  const titleCol = LABEL_COLS.find((c) => c in rec && rec[c]);
  const title = (titleCol ? String(rec[titleCol]) : id.slice(0, 8));
  const status = "status" in rec ? String(rec.status ?? "") : null;

  // Build the field rows (skip hidden + the title col + status).
  const fields: { label: string; node: React.ReactNode }[] = [];
  for (const [col, val] of Object.entries(rec)) {
    if (HIDDEN.has(col) || col === titleCol || col === "status") continue;
    const label = t(locale, humanize(col));
    if (fkByCol.has(col) && val) {
      const ftable = fkByCol.get(col)!;
      const lbl = await labelFor(db, meta.columns[ftable], ftable, String(val));
      const href = ROUTE[ftable];
      fields.push({
        label,
        node: href ? (
          <Link href={`${href}/${val}`} className="text-brand hover:underline">{lbl}</Link>
        ) : (
          <span>{lbl}</span>
        ),
      });
    } else {
      fields.push({ label, node: fmt(val) });
    }
  }

  // Line-item / child tables that reference this record. The suffix names the
  // panel (stops / accounts / taxes / items).
  const SUFFIX_LABEL: Record<string, string> = {
    _stops: "Stops", _accounts: "Accounts", _taxes: "Taxes", _lines: "Items", _items: "Items",
  };
  const childTables = Object.entries(meta.outgoing)
    .filter(([ct, fks]) => ct !== table && fks.some((f) => f.ftable === table) &&
      /(_items|_stops|_lines|_accounts|_taxes)$/.test(ct))
    .map(([ct, fks]) => {
      const suffix = Object.keys(SUFFIX_LABEL).find((s) => ct.endsWith(s))!;
      return { ct, col: fks.find((f) => f.ftable === table)!.column, titleKey: SUFFIX_LABEL[suffix] };
    });

  const children: { titleKey: string; cols: string[]; rows: Record<string, unknown>[] }[] = [];
  for (const { ct, col, titleKey } of childTables) {
    const rows = (await db.query<Record<string, unknown>>(
      `select * from "${ct}" where "${col}" = $1 limit 100`, [id]
    )).rows;
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]).filter((c) => !HIDDEN.has(c) && c !== col);
    children.push({ titleKey, cols, rows });
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5">
        <Link href={listHref} className="hover:text-brand">← {t(locale, listLabel)}</Link>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{title}</h1>
        {status ? <Indicator status={status} locale={locale} /> : null}
      </div>

      <Panel title={t(locale, "Details")}>
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-ink-gray-4">{f.label}</dt>
              <dd className="font-medium text-ink-gray-8">{f.node}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {children.map((c, ci) => (
        <Panel key={ci} title={`${t(locale, c.titleKey)} (${c.rows.length})`}>
          {c.rows.length === 0 ? (
            <EmptyRow text={t(locale, "None yet")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-ink-gray-4">
                    {c.cols.map((col) => <th key={col} className="px-4 py-2">{t(locale, humanize(col))}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-gray-1">
                  {c.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-gray-1">
                      {c.cols.map((col) => <td key={col} className="px-4 py-2">{fmt(row[col])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
