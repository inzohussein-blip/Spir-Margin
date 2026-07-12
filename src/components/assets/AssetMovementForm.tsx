"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveAssetMovement, type AssetMovementInput } from "@/app/actions/asset_movement";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function AssetMovementForm({
  devices,
  labs,
  warehouses,
}: {
  devices: Opt[];
  labs: Opt[];
  warehouses: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<AssetMovementInput>({
    defaultValues: {
      movement_no: "",
      purpose: "transfer",
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: "",
      items: [{ device_id: "", target_lab_id: "", target_warehouse_id: "", to_custodian: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const purpose = useWatch({ control, name: "purpose" });

  function onSubmit(values: AssetMovementInput) {
    start(async () => {
      const res = await saveAssetMovement(values);
      if (res.ok) router.push("/asset-movements");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Asset Movement</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">Movement no.</span>
            <input {...register("movement_no")} className={cls} placeholder="AM-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Purpose</span>
            <select {...register("purpose")} className={cls}>
              <option value="issue">issue (out to a lab)</option>
              <option value="receipt">receipt (back to a warehouse)</option>
              <option value="transfer">transfer</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Date</span>
            <input type="date" {...register("transaction_date")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">Notes</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Devices</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-ink-gray-5">
            Set the destination — a device sent to a lab is marked <em>installed</em>; one returned to a warehouse is marked <em>in stock</em>.
          </p>
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Device</span>
                  <select {...register(`items.${i}.device_id`)} className={cls}>
                    <option value="">Select…</option>
                    {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                {purpose !== "receipt" && (
                  <label className="block text-xs">
                    <span className="text-ink-gray-5">To lab</span>
                    <select {...register(`items.${i}.target_lab_id`)} className={cls}>
                      <option value="">—</option>
                      {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </label>
                )}
                {purpose !== "issue" && (
                  <label className="block text-xs">
                    <span className="text-ink-gray-5">To warehouse</span>
                    <select {...register(`items.${i}.target_warehouse_id`)} className={cls}>
                      <option value="">—</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </select>
                  </label>
                )}
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Custodian</span>
                  <input {...register(`items.${i}.to_custodian`)} className={cls} />
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ device_id: "", target_lab_id: "", target_warehouse_id: "", to_custodian: "" })}>
            <PlusIcon size={14} className="mr-1" /> Add device
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create movement (draft)
      </Button>
    </form>
  );
}
