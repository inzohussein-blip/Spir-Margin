import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string;
  item_code: string;
  name: string;
  product_type: string;
  item_group: string | null;
  brand: string | null;
  uom: string;
  default_buy_price: number;
  default_sell_price: number;
  is_disabled: boolean;
}

const typeBadge: Record<string, string> = {
  device: "bg-blue-100 text-blue-700",
  kit: "bg-purple-100 text-purple-700",
  spare_part: "bg-surface-gray-2 text-ink-gray-6",
};

export default async function ProductsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, item_code, name, product_type, item_group, brand, uom, default_buy_price, default_sell_price, is_disabled"
    )
    .order("name");
  const products = (data as ProductRow[]) ?? [];

  return (
    <ListShell
      title="Products (Items)"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Stock" }]}
      count={products.length}
      newHref="/products/new"
      newLabel="New product"
    >
        {products.length === 0 ? (
          <EmptyRow text="No products yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Group</th>
                  <th className="px-4 py-2">Brand</th>
                  <th className="px-4 py-2">UOM</th>
                  <th className="px-4 py-2">Buy</th>
                  <th className="px-4 py-2">Sell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {products.map((p) => (
                  <tr key={p.id} className={p.is_disabled ? "opacity-50" : ""}>
                    <td className="px-4 py-2 font-medium">{p.item_code}</td>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          typeBadge[p.product_type] ?? "bg-surface-gray-2"
                        }`}
                      >
                        {p.product_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {p.item_group ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {p.brand ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{p.uom}</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {p.default_buy_price}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {p.default_sell_price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </ListShell>
  );
}
