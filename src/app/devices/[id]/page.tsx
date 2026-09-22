import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

// The maintenance forecast linked every device here, and there was no page to
// land on — each of those links was a 404.
export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="devices" id={params.id} listHref="/devices" listLabel="Devices" />;
}
