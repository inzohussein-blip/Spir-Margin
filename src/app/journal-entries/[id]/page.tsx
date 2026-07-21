import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="journal_entries" id={params.id} listHref="/journal-entries" listLabel="Journal Entries" />;
}
