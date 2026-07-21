import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="asset_movements" id={params.id} listHref="/asset-movements" listLabel="Asset movements" />;
}
