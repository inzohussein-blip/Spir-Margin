import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface Row {
  id: string; date: string; from_currency: string; to_currency: string;
  exchange_rate: number; for_buying: boolean; for_selling: boolean;
}

export default async function CurrencyPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("currency_exchanges")
    .select("id, date, from_currency, to_currency, exchange_rate, for_buying, for_selling")
    .order("date", { ascending: false });
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Currency Exchange</h1>
        <Link href="/currency/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New rate</Link>
      </div>
      <Panel title={`Rates (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No exchange rates yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-ink-gray-5">{r.date}</td>
                    <td className="px-4 py-2 font-medium">{r.from_currency}</td>
                    <td className="px-4 py-2 font-medium">{r.to_currency}</td>
                    <td className="px-4 py-2">{Number(r.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td className="px-4 py-2 text-xs text-ink-gray-5">
                      {r.for_buying && "buying "}{r.for_selling && "selling"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
