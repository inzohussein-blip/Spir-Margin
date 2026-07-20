"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveJournalEntry, type JournalInput } from "@/app/actions/journal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function JournalForm({ accounts }: { accounts: string[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, control, handleSubmit } = useForm<JournalInput>({
    defaultValues: {
      posting_date: new Date().toISOString().slice(0, 10),
      user_remark: "",
      lines: [
        { account: "", debit: 0, credit: 0 },
        { account: "", debit: 0, credit: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const totalD = (lines ?? []).reduce((s, l) => s + (Number(l?.debit) || 0), 0);
  const totalC = (lines ?? []).reduce((s, l) => s + (Number(l?.credit) || 0), 0);
  const balanced = Math.abs(totalD - totalC) < 0.005 && totalD > 0;

  function onSubmit(values: JournalInput) {
    start(async () => {
      const res = await saveJournalEntry(values);
      if (res.ok) router.push("/journal-entries");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Journal Entry")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Posting date")}</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Remark")}</span>
            <input {...register("user_remark")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Accounts")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-2 block text-xs sm:col-span-3">
                <span className="text-ink-gray-5">{t(locale, "Account")}</span>
                <select {...register(`lines.${i}.account`)} className={cls}>
                  <option value="">{t(locale, "Select…")}</option>
                  {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Debit")}</span>
                <input type="number" step="0.01" {...register(`lines.${i}.debit`)} className={cls} />
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Credit")}</span>
                <input type="number" step="0.01" {...register(`lines.${i}.credit`)} className={cls} />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length <= 2}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ account: "", debit: 0, credit: 0 })}>
              <PlusIcon size={14} className="mr-1" /> {t(locale, "Add line")}
            </Button>
            <div className={`text-sm font-semibold ${balanced ? "text-ink-green-3" : "text-ink-red-3"}`}>
              Debit {totalD.toLocaleString()} · Credit {totalC.toLocaleString()} {balanced ? "· balanced" : "· unbalanced"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create journal (draft)")}
      </Button>
    </form>
  );
}
