import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="delivery_trips" id={params.id} listHref="/delivery-trips" listLabel="Delivery trips" />;
}
