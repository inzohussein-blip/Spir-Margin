import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { navGroups } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Number cards per workspace: a label + the table to count. */
const NUMBER_CARDS: Record<string, { label: string; table: string }[]> = {
  selling: [
    { label: "Labs", table: "labs" },
    { label: "Sales Invoices", table: "sales_invoices" },
    { label: "Quotations", table: "quotations" },
    { label: "Blanket Orders", table: "blanket_orders" },
  ],
  buying: [
    { label: "Suppliers", table: "companies" },
    { label: "Purchase Orders", table: "purchase_orders" },
    { label: "Purchase Receipts", table: "purchase_receipts" },
    { label: "RFQs", table: "rfqs" },
  ],
  stock: [
    { label: "Products", table: "products" },
    { label: "Kit Batches", table: "kit_batches" },
    { label: "Warehouses", table: "warehouses" },
    { label: "Pick Lists", table: "pick_lists" },
    { label: "Delivery Trips", table: "delivery_trips" },
  ],
  assets: [
    { label: "Devices", table: "devices" },
    { label: "Movements", table: "asset_movements" },
    { label: "Repairs", table: "asset_repairs" },
  ],
  maintenance: [
    { label: "Visits", table: "maintenance_visits" },
    { label: "PM Schedules", table: "maintenance_schedules" },
    { label: "Teams", table: "maintenance_teams" },
  ],
  support: [
    { label: "Issues", table: "issues" },
    { label: "Warranty Claims", table: "warranty_claims" },
  ],
  crm: [
    { label: "Leads", table: "leads" },
    { label: "Opportunities", table: "opportunities" },
    { label: "Contracts", table: "contracts" },
  ],
  accounting: [
    { label: "Payment Requests", table: "payment_requests" },
    { label: "Sales Invoices", table: "sales_invoices" },
  ],
};

export default async function WorkspacePage({ params }: { params: { slug: string } }) {
  const group = navGroups.find((g) => g.label.toLowerCase() === params.slug.toLowerCase());
  if (!group) notFound();

  const cards = NUMBER_CARDS[params.slug.toLowerCase()] ?? [];
  const supabase = createClient();
  const counts = await Promise.all(
    cards.map(async (c) => {
      const { data } = await supabase.from(c.table).select("id");
      return { label: c.label, n: (data as unknown[] | null)?.length ?? 0 };
    })
  );

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-ink-gray-5">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="text-ink-gray-3">/</span>
        <span>{group.label}</span>
      </nav>
      <h1 className="text-xl font-semibold text-ink-gray-8">{group.label}</h1>

      {counts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {counts.map((c) => (
            <div key={c.label} className="rounded-xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
              <div className="text-sm font-medium text-ink-gray-5">{c.label}</div>
              <div className="mt-2 text-3xl font-bold text-ink-gray-8">{c.n}</div>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-outline-gray-2 bg-surface-white shadow-sm">
        <header className="border-b border-outline-gray-1 px-5 py-3 text-sm font-semibold text-ink-gray-7">
          Shortcuts
        </header>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-outline-gray-1 px-4 py-3 text-sm font-medium text-ink-gray-7 transition-colors hover:border-brand hover:bg-surface-gray-1"
              >
                <Icon size={18} className="text-brand" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
