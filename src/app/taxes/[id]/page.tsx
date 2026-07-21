import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="tax_templates" id={params.id} listHref="/taxes" listLabel="Taxes" />;
}
