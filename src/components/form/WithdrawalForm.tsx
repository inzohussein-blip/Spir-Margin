"use client";

import { useState } from "react";
import { submitWithdrawal } from "@/app/actions/crud";
import { Field, TextInput, Select, SubmitButton } from "./Fields";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface BatchOpt {
  id: string;
  batch_no: string;
  buy_price: number;
  sell_price: number;
  qty_available: number;
  products: { name: string } | null;
}
interface LabOpt {
  id: string;
  code: string;
  name: string;
}

export function WithdrawalForm({
  batches,
  labs,
}: {
  batches: BatchOpt[];
  labs: LabOpt[];
}) {
  const locale = useLocale();
  const [batchId, setBatchId] = useState("");
  const selected = batches.find((b) => b.id === batchId);

  return (
    <form
      action={submitWithdrawal}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Field label={t(locale, "Kit batch")} required>
          <Select
            name="kit_batch_id"
            required
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="" disabled>
              {t(locale, "Select a batch…")}
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batch_no} — {b.products?.name ?? ""} (avail {b.qty_available})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t(locale, "Lab")} required>
        <Select name="lab_id" required defaultValue="">
          <option value="" disabled>
            {t(locale, "Select a lab…")}
          </option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.code})
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t(locale, "Quantity")} required>
        <TextInput
          name="qty"
          type="number"
          step="0.01"
          required
          max={selected?.qty_available}
        />
      </Field>
      <Field label={t(locale, "Buy price")}>
        <TextInput
          name="buy_price"
          type="number"
          step="0.01"
          defaultValue={selected?.buy_price ?? 0}
          key={`buy-${batchId}`}
        />
      </Field>
      <Field label={t(locale, "Sell price")}>
        <TextInput
          name="sell_price"
          type="number"
          step="0.01"
          defaultValue={selected?.sell_price ?? 0}
          key={`sell-${batchId}`}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t(locale, "Note")}>
          <TextInput name="note" placeholder={t(locale, "optional")} />
        </Field>
      </div>
      {selected && (
        <div className="sm:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t(locale, "Unit margin:")} {selected.sell_price - selected.buy_price} · {t(locale, "withdrawing marks the lab active and reduces batch stock.")}
        </div>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{t(locale, "Record withdrawal")}</SubmitButton>
      </div>
    </form>
  );
}
