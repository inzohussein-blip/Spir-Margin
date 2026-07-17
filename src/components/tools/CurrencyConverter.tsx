"use client";

import { useState } from "react";
import { ArrowRightLeftIcon } from "lucide-react";

const cls = "w-full rounded-md border border-outline-gray-2 px-3 py-2 text-lg font-semibold focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function CurrencyConverter({ rate }: { rate: number }) {
  const [usd, setUsd] = useState("1");
  const [dir, setDir] = useState<"usd2iqd" | "iqd2usd">("usd2iqd");

  const amount = Number(usd) || 0;
  const result = rate > 0 ? (dir === "usd2iqd" ? amount * rate : amount / rate) : 0;
  const fmt = (v: number, d = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(v || 0);

  return (
    <div className="max-w-md space-y-3 rounded-xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
      {rate <= 0 ? (
        <p className="text-sm text-amber-700">Set today&apos;s USD → IQD rate first (Currency page).</p>
      ) : (
        <p className="text-xs text-ink-gray-4">Rate: 1 USD = {fmt(rate, 0)} IQD</p>
      )}
      <div className="flex items-end gap-2">
        <label className="flex-1 text-sm">
          <span className="font-medium text-ink-gray-8">{dir === "usd2iqd" ? "USD" : "IQD"}</span>
          <input type="number" value={usd} onChange={(e) => setUsd(e.target.value)} className={cls} />
        </label>
        <button type="button" onClick={() => setDir((d) => (d === "usd2iqd" ? "iqd2usd" : "usd2iqd"))}
          className="mb-1 rounded-md border border-outline-gray-2 p-2 text-ink-gray-6 hover:bg-surface-gray-1" title="Swap">
          <ArrowRightLeftIcon size={18} />
        </button>
        <div className="flex-1 text-sm">
          <span className="font-medium text-ink-gray-8">{dir === "usd2iqd" ? "IQD" : "USD"}</span>
          <div className="mt-1 w-full truncate rounded-md bg-surface-gray-1 px-3 py-2 text-lg font-bold text-ink-gray-9">
            {fmt(result, dir === "usd2iqd" ? 0 : 2)}
          </div>
        </div>
      </div>
    </div>
  );
}
