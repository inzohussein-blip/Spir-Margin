import Link from "next/link";
import { MaintenanceTeamForm } from "@/components/maintenance/MaintenanceTeamForm";

export const dynamic = "force-dynamic";

export default function NewMaintenanceTeamPage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/maintenance-teams" className="hover:text-brand">← Maintenance teams</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Maintenance Team</h1>
      <MaintenanceTeamForm />
    </div>
  );
}
