import Link from "next/link";
import { ProfitCalculator } from "@/components/tools/ProfitCalculator";
import { getUsdIqdRate } from "@/app/actions/currency";

export const dynamic = "force-dynamic";

export default async function ProfitToolPage() {
  const rate = await getUsdIqdRate();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/tools" className="hover:text-brand">← Tools</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">Profit Calculator</h1>
      <ProfitCalculator usdToIqd={rate} />
    </div>
  );
}
