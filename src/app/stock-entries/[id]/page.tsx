import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="stock_entries" id={params.id} listHref="/stock-entries" listLabel="Stock entries" />;
}
