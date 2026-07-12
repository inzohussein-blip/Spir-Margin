import Link from "next/link";
import { getDevices, getLabs, getWarehouses } from "@/lib/queries";
import { AssetMovementForm } from "@/components/assets/AssetMovementForm";

export const dynamic = "force-dynamic";

export default async function NewAssetMovementPage() {
  const [devices, labs, warehouses] = await Promise.all([getDevices(), getLabs(), getWarehouses()]);
  const deviceOpts = devices.map((d) => {
    const prod = (d as { products?: { name?: string } | null }).products;
    return {
      id: d.id as string,
      label: `${d.asset_code as string}${prod?.name ? ` · ${prod.name}` : ""}${d.serial_no ? ` (${d.serial_no})` : ""}`,
    };
  });
  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const warehouseOpts = warehouses.map((w) => ({ id: w.id as string, label: w.name as string }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/asset-movements" className="hover:text-brand">← Asset movements</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Asset Movement</h1>
      <AssetMovementForm devices={deviceOpts} labs={labOpts} warehouses={warehouseOpts} />
    </div>
  );
}
