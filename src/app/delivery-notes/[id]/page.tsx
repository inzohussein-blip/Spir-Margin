import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="delivery_notes" id={params.id} listHref="/delivery-notes" listLabel="Delivery Notes" />;
}
