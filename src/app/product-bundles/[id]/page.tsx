import { RecordDetail } from "@/components/desk/RecordDetail";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <RecordDetail table="product_bundles" id={params.id} listHref="/product-bundles" listLabel="Product bundles" />;
}
