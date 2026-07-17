import Link from "next/link";
import { Calculator } from "@/components/tools/Calculator";

export const dynamic = "force-dynamic";

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/tools" className="hover:text-brand">← Tools</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">Calculator</h1>
      <Calculator />
    </div>
  );
}
