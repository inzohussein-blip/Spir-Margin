"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveRule, type RuleInput } from "@/app/actions/banking";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PartyOpt { value: string; label: string; }

const inputCls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function RuleForm({
  parties,
  initial,
}: {
  parties: PartyOpt[];
  initial?: RuleInput;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit, formState: { errors } } = useForm<RuleInput>({
    defaultValues: initial ?? {
      rule_name: "",
      transaction_type: "any",
      priority: 1,
      min_amount: null,
      max_amount: null,
      classify_as: "payment_entry",
      party: "",
      conditions: [{ field: "description", operator: "contains", value: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "conditions" });

  function onSubmit(values: RuleInput) {
    start(async () => {
      const res = await saveRule({
        ...values,
        id: initial?.id,
        priority: Number(values.priority),
        min_amount: values.min_amount ? Number(values.min_amount) : null,
        max_amount: values.max_amount ? Number(values.max_amount) : null,
        party: values.party || null,
      });
      if (res.ok) router.push("/banking/rules");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Rule</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">Rule name *</span>
            <input {...register("rule_name", { required: true })} className={inputCls} placeholder="Al-Kindy inflows" />
            {errors.rule_name && <span className="text-xs text-red-500">Required</span>}
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Priority</span>
            <input type="number" {...register("priority")} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Applies to</span>
            <select {...register("transaction_type")} className={inputCls}>
              <option value="any">any</option>
              <option value="deposit">deposit</option>
              <option value="withdrawal">withdrawal</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Classify as</span>
            <select {...register("classify_as")} className={inputCls}>
              <option value="payment_entry">payment entry</option>
              <option value="bank_entry">bank entry</option>
              <option value="transfer">transfer</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Min amount</span>
            <input type="number" step="0.01" {...register("min_amount")} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Max amount</span>
            <input type="number" step="0.01" {...register("max_amount")} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">Set party (optional)</span>
            <select {...register("party")} className={inputCls}>
              <option value="">— none —</option>
              {parties.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conditions (all must match)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="flex flex-wrap items-end gap-2">
              <label className="block text-sm">
                <span className="text-ink-gray-5">Field</span>
                <select {...register(`conditions.${i}.field`)} className={inputCls}>
                  <option value="description">description</option>
                  <option value="reference_number">reference number</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink-gray-5">Operator</span>
                <select {...register(`conditions.${i}.operator`)} className={inputCls}>
                  <option value="contains">contains</option>
                  <option value="equals">equals</option>
                  <option value="starts_with">starts with</option>
                </select>
              </label>
              <label className="block flex-1 text-sm">
                <span className="text-ink-gray-5">Value</span>
                <input {...register(`conditions.${i}.value`)} className={inputCls} placeholder="AL-KINDY" />
              </label>
              <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                <Trash2Icon size={14} />
              </Button>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ field: "description", operator: "contains", value: "" })}>
            <PlusIcon size={14} className="mr-1" /> Add condition
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {initial?.id ? "Save changes" : "Create rule"}
      </Button>
    </form>
  );
}
