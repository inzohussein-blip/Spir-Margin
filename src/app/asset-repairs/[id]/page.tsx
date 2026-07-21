import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="asset_repairs" id={params.id} listHref="/asset-repairs" listLabel="Asset repairs" />;
}
