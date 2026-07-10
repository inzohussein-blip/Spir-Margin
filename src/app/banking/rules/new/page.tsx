import Link from "next/link";
import { getPartyOptions } from "@/lib/banking";
import { RuleForm } from "@/components/banking/RuleForm";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  const parties = await getPartyOptions();
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/banking/rules" className="hover:text-brand">← Rules</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">New Matching Rule</h1>
      <RuleForm parties={parties} />
    </div>
  );
}
