import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="supplier_quotations" id={params.id} listHref="/supplier-quotations" listLabel="Supplier Quotations" />;
}
