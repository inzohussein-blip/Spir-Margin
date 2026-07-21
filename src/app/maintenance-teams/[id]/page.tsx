import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="maintenance_teams" id={params.id} listHref="/maintenance-teams" listLabel="Maintenance teams" />;
}
