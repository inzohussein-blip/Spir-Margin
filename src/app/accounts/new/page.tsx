import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { createAccount } from "@/app/actions/accounts";
import { Field, TextInput, Select, Checkbox, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("accounts").select("account_name").eq("is_group", true).order("account_name");
  const groups = (data ?? []).map((g) => g.account_name as string);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/accounts" className="hover:text-brand">← {t(locale, "Chart of Accounts")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Account")}</h1>
      <FormCard title={t(locale, "Account")}>
        <form action={createAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Account name")} required><TextInput name="account_name" required /></Field>
          <Field label={t(locale, "Account number")}><TextInput name="account_number" /></Field>
          <Field label={t(locale, "Root type")} required>
            <Select name="root_type" defaultValue="asset">
              <option value="asset">asset</option>
              <option value="liability">liability</option>
              <option value="income">income</option>
              <option value="expense">expense</option>
              <option value="equity">equity</option>
            </Select>
          </Field>
          <Field label={t(locale, "Account type")}><TextInput name="account_type" placeholder="Bank / Receivable / …" /></Field>
          <Field label={t(locale, "Parent account")}>
            <Select name="parent_account" defaultValue="">
              <option value="">— none —</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Currency")}><TextInput name="currency" defaultValue="USD" /></Field>
          <div className="flex items-end"><Checkbox name="is_group" label="Is group" /></div>
          <div className="sm:col-span-2"><SubmitButton>{t(locale, "Create account")}</SubmitButton></div>
        </form>
      </FormCard>
    </div>
  );
}
