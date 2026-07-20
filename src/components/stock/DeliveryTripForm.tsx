"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveDeliveryTrip, type DeliveryTripInput } from "@/app/actions/delivery_trip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function DeliveryTripForm({
  labs,
  deliveryNotes,
}: {
  labs: Opt[];
  deliveryNotes: Opt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<DeliveryTripInput>({
    defaultValues: {
      trip_no: "",
      driver_name: "",
      vehicle: "",
      departure_date: new Date().toISOString().slice(0, 10),
      notes: "",
      stops: [{ lab_id: "", delivery_note_id: "", address: "", seq: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "stops" });

  function onSubmit(values: DeliveryTripInput) {
    start(async () => {
      const res = await saveDeliveryTrip(values);
      if (res.ok) router.push("/delivery-trips");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Delivery Trip")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Trip no.")}</span>
            <input {...register("trip_no")} className={cls} placeholder={t(locale, "auto if blank")} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Departure date")}</span>
            <input type="date" {...register("departure_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Driver")}</span>
            <input {...register("driver_name")} className={cls} placeholder={t(locale, "Driver name")} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Vehicle")}</span>
            <input {...register("vehicle")} className={cls} placeholder={t(locale, "Plate / vehicle")} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Notes")}</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Stops (in order)")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Seq")}</span>
                  <input type="number" {...register(`stops.${i}.seq`)} className={cls} />
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="text-ink-gray-5">{t(locale, "Lab")}</span>
                  <select {...register(`stops.${i}.lab_id`)} className={cls}>
                    <option value="">{t(locale, "— none —")}</option>
                    {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="text-ink-gray-5">{t(locale, "Delivery note")}</span>
                  <select {...register(`stops.${i}.delivery_note_id`)} className={cls}>
                    <option value="">{t(locale, "— none —")}</option>
                    {deliveryNotes.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
                <label className="block text-xs sm:col-span-6">
                  <span className="text-ink-gray-5">{t(locale, "Address (optional)")}</span>
                  <input {...register(`stops.${i}.address`)} className={cls} placeholder={t(locale, "Delivery address / directions")} />
                </label>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ lab_id: "", delivery_note_id: "", address: "", seq: fields.length + 1 })}>
            <PlusIcon size={14} className="mr-1" /> {t(locale, "Add stop")}
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create trip (draft)")}
      </Button>
    </form>
  );
}
