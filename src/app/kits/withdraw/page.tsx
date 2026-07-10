import Link from "next/link";
import { getKitBatches, getLabs } from "@/lib/queries";
import { WithdrawalForm } from "@/components/form/WithdrawalForm";
import { FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function WithdrawPage() {
  const [batches, labs] = await Promise.all([getKitBatches(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/kits" className="hover:text-brand">
          ← Kits
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Record Withdrawal</h1>
      <FormCard title="Lab pulls kits from stock">
        <WithdrawalForm batches={batches as never} labs={labs as never} />
      </FormCard>
    </div>
  );
}
