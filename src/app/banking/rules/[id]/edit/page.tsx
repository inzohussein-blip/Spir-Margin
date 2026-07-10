import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPartyOptions } from "@/lib/banking";
import { RuleForm } from "@/components/banking/RuleForm";
import type { RuleInput } from "@/app/actions/banking";

export const dynamic = "force-dynamic";

export default async function EditRulePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [{ data: rule }, parties] = await Promise.all([
    supabase
      .from("bank_transaction_rules")
      .select("*, bank_rule_conditions(field, operator, value)")
      .eq("id", params.id)
      .single(),
    getPartyOptions(),
  ]);
  if (!rule) notFound();

  const party =
    rule.party_company_id
      ? `company:${rule.party_company_id}`
      : rule.party_lab_id
      ? `lab:${rule.party_lab_id}`
      : "";

  const initial: RuleInput = {
    id: rule.id,
    rule_name: rule.rule_name,
    transaction_type: rule.transaction_type,
    priority: rule.priority,
    min_amount: rule.min_amount,
    max_amount: rule.max_amount,
    classify_as: rule.classify_as,
    party,
    conditions:
      rule.bank_rule_conditions?.length
        ? rule.bank_rule_conditions
        : [{ field: "description", operator: "contains", value: "" }],
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking/rules" className="hover:text-brand">← Rules</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">Edit Rule</h1>
      <RuleForm parties={parties} initial={initial} />
    </div>
  );
}
