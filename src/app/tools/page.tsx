import Link from "next/link";
import { CalculatorIcon, TrendingUpIcon, ArrowRightLeftIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TOOLS = [
  { href: "/tools/calculator", label: "Calculator", desc: "A general-purpose calculator.", icon: CalculatorIcon },
  { href: "/tools/profit", label: "Profit Calculator", desc: "Cost, sell price and quantity → profit, margin and markup (USD + IQD).", icon: TrendingUpIcon },
  { href: "/tools/converter", label: "Currency Converter", desc: "Convert between USD and IQD at today's rate.", icon: ArrowRightLeftIcon },
];

export default function ToolsPage() {
  const locale = getLocale();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Tools")}</h1>
        <p className="text-sm text-ink-gray-5">{t(locale, "Handy calculators and converters.")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-lg border border-outline-gray-2 bg-surface-white p-5 hover:border-brand hover:shadow-sm">
            <div className="flex items-center gap-2 text-ink-gray-8">
              <span className="grid size-9 place-items-center rounded-md bg-surface-gray-2 text-ink-gray-6 group-hover:bg-brand group-hover:text-white">
                <t.icon size={18} />
              </span>
              <span className="font-semibold">{t.label}</span>
            </div>
            <p className="mt-2 text-sm text-ink-gray-5">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
