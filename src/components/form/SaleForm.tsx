"use client";

import { useState } from "react";
import { submitSale } from "@/app/actions/crud";
import { Field, TextInput, Select, SubmitButton } from "./Fields";

interface ProductOpt {
  id: string;
  item_code: string;
  name: string;
  default_buy_price: number;
  default_sell_price: number;
}
interface LabOpt {
  id: string;
  code: string;
  name: string;
}

export function SaleForm({
  products,
  labs,
}: {
  products: ProductOpt[];
  labs: LabOpt[];
}) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [buy, setBuy] = useState(0);
  const [sell, setSell] = useState(0);

  function onPickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setBuy(Number(p.default_buy_price));
      setSell(Number(p.default_sell_price));
    }
  }

  const profit = (sell - buy) * (qty || 0);

  return (
    <form action={submitSale} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Lab" required>
        <Select name="lab_id" required defaultValue="">
          <option value="" disabled>
            Select a lab…
          </option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.code})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Product" required>
        <Select
          name="product_id"
          required
          value={productId}
          onChange={(e) => onPickProduct(e.target.value)}
        >
          <option value="" disabled>
            Select a product…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.item_code})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantity" required>
        <TextInput
          name="qty"
          type="number"
          step="0.01"
          required
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </Field>
      <div />
      <Field label="Buy price (cost)">
        {/* Cost is authoritative from the product — the server re-reads it, so
            it's shown read-only here (never submitted). */}
        <div className="rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-sm text-ink-gray-6">
          {buy.toLocaleString()} <span className="text-xs text-ink-gray-4">— from product</span>
        </div>
      </Field>
      <Field label="Sell price">
        <TextInput
          name="sell_price"
          type="number"
          step="0.01"
          value={sell}
          onChange={(e) => setSell(Number(e.target.value))}
        />
      </Field>
      <div className="sm:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        Profit on this sale: {profit.toLocaleString()}
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>Record sale</SubmitButton>
      </div>
    </form>
  );
}
