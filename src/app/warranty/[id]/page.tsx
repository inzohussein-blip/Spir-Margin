import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="warranty_claims" id={params.id} listHref="/warranty" listLabel="Warranty Claims" />;
}
