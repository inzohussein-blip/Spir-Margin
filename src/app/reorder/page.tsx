import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { SubmitButton } from "@/components/form/Fields";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { generateReorderPos } from "@/app/actions/reorder";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  product_id: string;
  item_code: string;
  product_name: string;
  reorder_level: number;
  on_hand: number;
  shortfall: number;
  supplier_name: string | null;
  default_buy_price: number;
}

export default async function ReorderPage({ searchParams }: { searchParams: { created?: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_reorder_suggestions").select("*");
  const rows = (data as unknown as Row[]) ?? [];
  const estValue = rows.reduce((s, r) => s + Number(r.shortfall) * Number(r.default_buy_price), 0);
  const created = searchParams.created != null ? Number(searchParams.created) : null;
  const withSupplier = rows.filter((r) => r.supplier_name).length;

  return (
    <ListShell
      title={t(locale, "Reorder")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Buying") }]}
      count={rows.length}
      filterPlaceholder={t(locale, "Filter by product / supplier…")}
    >
      {created != null ? (
        <div className="mx-4 mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {created > 0
            ? `${t(locale, "Draft purchase orders created")}: ${created}`
            : t(locale, "Nothing new to order — everything short is already on an open PO.")}
        </div>
      ) : null}

      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-ink-gray-5">
          {t(locale, "Products below their reorder level. Generating raises one draft PO per supplier.")}
        </p>
        <form action={generateReorderPos}>
          <SubmitButton disabled={withSupplier === 0}>{t(locale, "Generate draft POs")}</SubmitButton>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "Stock is healthy — nothing to reorder.")} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Item code")}</th>
              <th className="px-4 py-2">{t(locale, "Product")}</th>
              <th className="px-4 py-2">{t(locale, "Supplier")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "On hand")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "Reorder level")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "Shortfall")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "Est. cost")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <tr key={r.product_id} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.item_code}</td>
                <td className="px-4 py-2">{r.product_name}</td>
                <td className="px-4 py-2 text-ink-gray-5">{r.supplier_name ?? t(locale, "— no supplier —")}</td>
                <td className="px-4 py-2 text-end">{Number(r.on_hand)}</td>
                <td className="px-4 py-2 text-end text-ink-gray-5">{Number(r.reorder_level)}</td>
                <td className="px-4 py-2 text-end font-semibold text-amber-600">{Number(r.shortfall)}</td>
                <td className="px-4 py-2 text-end">{money(Number(r.shortfall) * Number(r.default_buy_price))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-outline-gray-2 font-semibold">
              <td className="px-4 py-2" colSpan={6}>{t(locale, "Estimated reorder value")}</td>
              <td className="px-4 py-2 text-end">{money(estValue)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </ListShell>
  );
}
