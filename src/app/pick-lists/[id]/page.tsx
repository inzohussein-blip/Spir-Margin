import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="pick_lists" id={params.id} listHref="/pick-lists" listLabel="Pick lists" />;
}
