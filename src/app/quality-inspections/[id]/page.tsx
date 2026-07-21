import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="quality_inspections" id={params.id} listHref="/quality-inspections" listLabel="Quality inspections" />;
}
