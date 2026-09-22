"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { saveAuthorization, type AuthorizationInput } from "@/app/actions/authorization";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLocale } from "@/components/LocaleProvider";
import { GOVERNORATES } from "@/lib/governorates";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";

interface DeviceOpt { id: string; label: string; serial: string | null; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const today = () => localDate();
const inDays = (n: number) => localDate(new Date(Date.now() + n * 86400000));

/**
 * A transport authorisation.
 *
 * This is a document that gets shown at a checkpoint, so the fields are the
 * ones someone there will ask about: who is carrying it, what they are
 * carrying, in whose vehicle, between which governorates, and until when.
 */
export function AuthorizationForm({ devices }: { devices: DeviceOpt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { register, control, handleSubmit, setValue } = useForm<AuthorizationInput>({
    defaultValues: {
      issue_date: today(),
      valid_from: today(),
      valid_to: inDays(7),
      addressed_to: "",
      bearer_name: "",
      bearer_id_no: "",
      bearer_phone: "",
      driver_name: "",
      vehicle_type: "",
      vehicle_plate: "",
      from_governorate: GOVERNORATES[0],
      to_governorate: GOVERNORATES[1],
      destination: "",
      purpose: "",
      notes: "",
      items: [{ device_id: "", description: "", qty: 1, unit: "", serial_no: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onPickDevice = (i: number, id: string) => {
    const d = devices.find((x) => x.id === id);
    if (!d) return;
    setValue(`items.${i}.description`, d.label);
    if (d.serial) setValue(`items.${i}.serial_no`, d.serial);
  };

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await saveAuthorization(values);
      if (res && "error" in res && res.error) setError(t(locale, res.error));
      else router.refresh();
    });
  });

  const Text = ({ name, label, dir }: { name: keyof AuthorizationInput; label: string; dir?: "ltr" }) => (
    <label className="block">
      <span className="text-sm font-medium text-ink-gray-7">{label}</span>
      <input {...register(name as never)} className={cls} dir={dir} />
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{t(locale, "The journey")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "From governorate")}</span>
              <select {...register("from_governorate")} className={cls}>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "To governorate")}</span>
              <select {...register("to_governorate")} className={cls}>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <Text name="destination" label={t(locale, "Destination (lab or hospital)")} />
            <Text name="addressed_to" label={t(locale, "Addressed to")} />
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Valid from")}</span>
              <input type="date" lang="en-CA" {...register("valid_from")} className={cls} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Valid to")}</span>
              <input type="date" lang="en-CA" {...register("valid_to")} className={cls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Purpose")}</span>
              <input {...register("purpose")} className={cls}
                placeholder={t(locale, "Delivery, installation, maintenance, return…")} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Who is carrying it")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Text name="bearer_name" label={t(locale, "Authorised person")} />
            <Text name="bearer_id_no" label={t(locale, "ID number")} dir="ltr" />
            <Text name="bearer_phone" label={t(locale, "Phone")} dir="ltr" />
            <Text name="driver_name" label={t(locale, "Driver")} />
            <Text name="vehicle_type" label={t(locale, "Vehicle")} />
            <Text name="vehicle_plate" label={t(locale, "Plate number")} dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "What is being moved")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <div key={f.id} className="grid gap-2 rounded-lg border border-outline-gray-2 p-3 sm:grid-cols-[1fr_1fr_4.5rem_5rem_1fr_2.5rem] sm:items-end">
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Device")}</span>
                  <select
                    {...register(`items.${i}.device_id`)}
                    className={cls}
                    onChange={(e) => {
                      register(`items.${i}.device_id`).onChange(e);
                      onPickDevice(i, e.target.value);
                    }}
                  >
                    <option value="">{t(locale, "— free text —")}</option>
                    {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Description")}</span>
                  <input {...register(`items.${i}.description`)} className={cls} />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Qty")}</span>
                  <input type="number" step="any" min="0" {...register(`items.${i}.qty`, { valueAsNumber: true })} className={cls} />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Unit")}</span>
                  <input {...register(`items.${i}.unit`)} className={cls} />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Serial no.")}</span>
                  <input {...register(`items.${i}.serial_no`)} className={cls} dir="ltr" />
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={fields.length === 1}
                  title={t(locale, "Remove this line")}
                  className="mb-1 grid size-9 place-items-center rounded-md border border-outline-gray-2 text-ink-gray-5 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2Icon size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ device_id: "", description: "", qty: 1, unit: "", serial_no: "" })}
              className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand"
            >
              <PlusIcon size={15} /> {t(locale, "Add a line")}
            </button>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Notes")}</span>
            <textarea {...register("notes")} rows={2} className={cls} />
          </label>
        </CardContent>
      </Card>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-95 disabled:opacity-60"
      >
        {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
        {t(locale, "Issue the authorisation")}
      </button>
    </form>
  );
}
