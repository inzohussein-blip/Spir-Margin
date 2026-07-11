import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLabs } from "@/lib/queries";
import { DeliveryNoteForm } from "@/components/selling/DeliveryNoteForm";

export const dynamic = "force-dynamic";

export default async function NewDeliveryNotePage() {
  const supabase = createClient();
  const [{ data }, labs] = await Promise.all([
    supabase.from("kit_batches").select("id, batch_no, qty_available, products(name)").gt("qty_available", 0).order("batch_no"),
    getLabs(),
  ]);
  const batches = (data as unknown as { id: string; batch_no: string; qty_available: number; products: { name: string } | null }[]) ?? [];
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/delivery-notes" className="hover:text-brand">← Delivery Notes</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Delivery Note</h1>
      <DeliveryNoteForm
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        batches={batches.map((b) => ({ id: b.id, label: `${b.batch_no} (${b.products?.name ?? ""})`, available: Number(b.qty_available) }))}
      />
    </div>
  );
}
