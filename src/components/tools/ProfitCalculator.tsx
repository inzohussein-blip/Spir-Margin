"use client";

import { useState } from "react";

const cls = "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const n = (v: string) => (v === "" ? 0 : Number(v) || 0);

export function ProfitCalculator({ usdToIqd = 0 }: { usdToIqd?: number }) {
  const [cost, setCost] = useState("");
  const [sell, setSell] = useState("");
  const [qty, setQty] = useState("1");

  const c = n(cost), s = n(sell), q = n(qty) || 1;
  const unitProfit = s - c;
  const totalProfit = unitProfit * q;
  const totalCost = c * q;
  const totalRevenue = s * q;
  const margin = s > 0 ? (unitProfit / s) * 100 : 0;   // profit / sell
  const markup = c > 0 ? (unitProfit / c) * 100 : 0;    // profit / cost

  const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
  const iqd = (v: number) => (usdToIqd > 0 ? `${new Intl.NumberFormat("en-US").format(Math.round(v * usdToIqd))} IQD` : null);

  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">Cost (USD)</span>
          <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={cls} placeholder="0" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">Sell (USD)</span>
          <input type="number" step="0.01" value={sell} onChange={(e) => setSell(e.target.value)} className={cls} placeholder="0" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">Qty</span>
          <input type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className={cls} placeholder="1" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Unit profit" value={usd(unitProfit)} sub={iqd(unitProfit)} good={unitProfit >= 0} />
        <Stat label="Total profit" value={usd(totalProfit)} sub={iqd(totalProfit)} good={totalProfit >= 0} strong />
        <Stat label="Margin" value={`${margin.toFixed(1)}%`} />
        <Stat label="Markup" value={`${markup.toFixed(1)}%`} />
        <Stat label="Total cost" value={usd(totalCost)} sub={iqd(totalCost)} />
        <Stat label="Total revenue" value={usd(totalRevenue)} sub={iqd(totalRevenue)} />
      </div>
      {usdToIqd > 0 ? (
        <p className="text-xs text-ink-gray-4">IQD values use today&apos;s rate: 1 USD = {new Intl.NumberFormat("en-US").format(usdToIqd)} IQD.</p>
      ) : (
        <p className="text-xs text-ink-gray-4">Set today&apos;s USD → IQD rate in Currency to see dinar values.</p>
      )}
    </div>
  );
}

function Stat({ label, value, sub, good, strong }: { label: string; value: string; sub?: string | null; good?: boolean; strong?: boolean }) {
  return (
    <div className={`rounded-lg border border-outline-gray-1 p-3 ${strong ? "bg-surface-gray-1" : ""}`}>
      <div className="text-xs text-ink-gray-4">{label}</div>
      <div className={`text-lg font-bold ${good === undefined ? "text-ink-gray-9" : good ? "text-emerald-700" : "text-red-700"}`}>{value}</div>
      {sub ? <div className="text-xs text-ink-gray-4">{sub}</div> : null}
    </div>
  );
}
