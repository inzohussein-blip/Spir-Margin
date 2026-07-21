import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="payment_requests" id={params.id} listHref="/payment-requests" listLabel="Payment requests" />;
}
