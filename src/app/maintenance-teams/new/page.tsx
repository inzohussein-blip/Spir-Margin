import Link from "next/link";
import { MaintenanceTeamForm } from "@/components/maintenance/MaintenanceTeamForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default function NewMaintenanceTeamPage() {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/maintenance-teams" className="hover:text-brand">← {t(locale, "Maintenance teams")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Maintenance Team")}</h1>
      <MaintenanceTeamForm />
    </div>
  );
}
