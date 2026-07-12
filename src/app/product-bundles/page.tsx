import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { deleteProductBundleForm } from "@/app/actions/product_bundle";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  description: string | null;
  is_active: boolean;
  bundle_value: number;
  products: { name: string; item_code: string | null } | null;
  product_bundle_items: { id: string }[];
}

export default async function ProductBundlesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("product_bundles")
    .select("id, description, is_active, bundle_value, products(name, item_code), product_bundle_items(id)")
    .order("created_at", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Product Bundles</h1>
        <Link href="/product-bundles/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New bundle</Link>
      </div>

      <Panel title={`Bundles (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No bundles yet — group items sold together as one kit" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Bundle</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Components</th>
                  <th className="px-4 py-2">Value</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2 font-medium">
                      {b.products?.name ?? "—"}
                      {b.products?.item_code ? <span className="text-ink-gray-4"> ({b.products.item_code})</span> : null}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{b.description ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{b.product_bundle_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(b.bundle_value).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-surface-gray-2 text-ink-gray-6"}`}>
                        {b.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <form action={deleteProductBundleForm}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Delete</button>
                      </form>
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
