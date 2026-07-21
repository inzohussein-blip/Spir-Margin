import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JournalForm } from "@/components/accounts/JournalForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewJournalPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("accounts").select("account_name").eq("is_group", false).eq("disabled", false).order("account_number", { nullsFirst: false });
  const accounts = (data ?? []).map((a) => a.account_name as string);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/journal-entries" className="hover:text-brand">← {t(locale, "Journal Entries")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Journal Entry")}</h1>
      <JournalForm accounts={accounts} />
    </div>
  );
}
