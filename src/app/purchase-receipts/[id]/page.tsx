import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="purchase_receipts" id={params.id} listHref="/purchase-receipts" listLabel="Purchase receipts" />;
}
