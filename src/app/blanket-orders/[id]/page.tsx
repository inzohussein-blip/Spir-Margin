import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="blanket_orders" id={params.id} listHref="/blanket-orders" listLabel="Blanket orders" />;
}
