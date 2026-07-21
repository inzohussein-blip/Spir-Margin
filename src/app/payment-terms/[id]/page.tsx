import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="payment_terms" id={params.id} listHref="/payment-terms" listLabel="Payment Terms" />;
}
