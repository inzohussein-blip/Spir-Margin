import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="material_requests" id={params.id} listHref="/material-requests" listLabel="Material Requests" />;
}
