import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="warehouses" id={params.id} listHref="/warehouses" listLabel="Warehouses" />;
}
