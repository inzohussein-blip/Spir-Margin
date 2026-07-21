import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="cost_centers" id={params.id} listHref="/cost-centers" listLabel="Cost centers" />;
}
