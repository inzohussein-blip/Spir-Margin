import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="serial_numbers" id={params.id} listHref="/serials" listLabel="Serials" />;
}
