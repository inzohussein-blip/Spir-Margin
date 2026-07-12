import Link from "next/link";
import { getLabs, getDevices } from "@/lib/queries";
import { MaintenanceVisitForm } from "@/components/maintenance/MaintenanceVisitForm";

export const dynamic = "force-dynamic";

export default async function NewMaintenanceVisitPage() {
  const [labs, devices] = await Promise.all([getLabs(), getDevices()]);
  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const deviceOpts = devices.map((d) => {
    const prod = (d as { products?: { name?: string } | null }).products;
    return {
      id: d.id as string,
      label: `${d.asset_code as string}${prod?.name ? ` · ${prod.name}` : ""}${d.serial_no ? ` (${d.serial_no})` : ""}`,
      lab_id: (d.lab_id as string | null) ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/maintenance-visits" className="hover:text-brand">← Maintenance visits</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Maintenance Visit</h1>
      <MaintenanceVisitForm labs={labOpts} devices={deviceOpts} />
    </div>
  );
}
