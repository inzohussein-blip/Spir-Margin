import Link from "next/link";
import { getKitBatches, getLabs } from "@/lib/queries";
import { WithdrawalForm } from "@/components/form/WithdrawalForm";
import { FormCard } from "@/components/form/Fields";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function WithdrawPage() {
  const locale = getLocale();
  const [batches, labs] = await Promise.all([getKitBatches(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/kits" className="hover:text-brand">
          ← Kits
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Record Withdrawal")}</h1>
      <FormCard title={t(locale, "Lab pulls kits from stock")}>
        <WithdrawalForm batches={batches as never} labs={labs as never} />
      </FormCard>
    </div>
  );
}
