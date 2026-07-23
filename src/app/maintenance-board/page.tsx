import { createClient } from "@/lib/supabase/server";
import { MaintenanceBoard, type Visit } from "@/components/maintenance/MaintenanceBoard";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Raw {
  id: string; visit_no: string; visit_date: string; service_person: string | null;
  maintenance_type: string; completion_status: "pending" | "partial" | "full";
  labs: { name: string } | null;
}

export default async function MaintenanceBoardPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("maintenance_visits")
    .select("id, visit_no, visit_date, service_person, maintenance_type, completion_status, labs(name)")
    .neq("status", "cancelled")
    .order("visit_date", { ascending: false });
  const visits: Visit[] = ((data as unknown as Raw[]) ?? []).map((v) => ({
    id: v.id, visit_no: v.visit_no, visit_date: v.visit_date,
    service_person: v.service_person, maintenance_type: v.maintenance_type,
    completion_status: v.completion_status, lab_name: v.labs?.name ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Field Service Board")}</h1>
        <p className="text-sm text-ink-gray-5">{t(locale, "Drag a visit to update its progress.")}</p>
      </div>
      <MaintenanceBoard initial={visits} />
    </div>
  );
}
