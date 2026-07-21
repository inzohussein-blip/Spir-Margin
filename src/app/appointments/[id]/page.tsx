import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="appointments" id={params.id} listHref="/appointments" listLabel="Appointments" />;
}
