import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import {
  CoinsIcon, PackageIcon, FlaskConicalIcon, TrendingUpIcon, ShoppingCartIcon, ClipboardListIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

const REPORTS = [
  { href: "/reports/receivables", label: "Accounts Receivable Aging", desc: "Open invoices bucketed by how overdue they are.", icon: CoinsIcon },
  { href: "/reports/sales-by-product", label: "Sales by Product", desc: "Quantity sold and revenue per item.", icon: PackageIcon },
  { href: "/reports/sales-by-lab", label: "Sales by Lab", desc: "Billed, paid and outstanding per lab.", icon: FlaskConicalIcon },
  { href: "/reports/profitability", label: "Profitability", desc: "Revenue vs cost and margin per product.", icon: TrendingUpIcon },
  { href: "/reports/purchases", label: "Purchase Spend", desc: "Total purchasing spend per supplier.", icon: ShoppingCartIcon },
  { href: "/stock-balance", label: "Stock Balance", desc: "On-hand quantity and valuation per warehouse.", icon: ClipboardListIcon },
];

export default function ReportsPage() {
  const locale = getLocale();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Reports")}</h1>
        <p className="text-sm text-ink-gray-5">Financial, sales and stock analytics.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="group rounded-lg border border-outline-gray-2 bg-surface-white p-5 hover:border-brand hover:shadow-sm">
            <div className="flex items-center gap-2 text-ink-gray-8">
              <span className="grid size-9 place-items-center rounded-md bg-surface-gray-2 text-ink-gray-6 group-hover:bg-brand group-hover:text-white">
                <r.icon size={18} />
              </span>
              <span className="font-semibold">{r.label}</span>
            </div>
            <p className="mt-2 text-sm text-ink-gray-5">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
