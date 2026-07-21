import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="pricing_rules" id={params.id} listHref="/pricing-rules" listLabel="Pricing rules" />;
}
