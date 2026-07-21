import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="maintenance_schedules" id={params.id} listHref="/maintenance-schedules" listLabel="Maintenance schedules" />;
}
