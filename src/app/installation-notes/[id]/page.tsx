import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="installation_notes" id={params.id} listHref="/installation-notes" listLabel="Installation notes" />;
}
