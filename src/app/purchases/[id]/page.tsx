import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="purchase_invoices" id={params.id} listHref="/purchases" listLabel="Purchases" />;
}
