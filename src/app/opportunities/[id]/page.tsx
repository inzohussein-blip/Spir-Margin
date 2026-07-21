import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="opportunities" id={params.id} listHref="/opportunities" listLabel="Opportunities" />;
}
