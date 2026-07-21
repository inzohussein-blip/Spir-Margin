import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="sales_orders" id={params.id} listHref="/sales-orders" listLabel="Sales Orders" />;
}
