import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLabs } from "@/lib/queries";
import { DeliveryTripForm } from "@/components/stock/DeliveryTripForm";

export const dynamic = "force-dynamic";

interface DnRow {
  id: string;
  posting_date: string;
  naming_series: string | null;
  labs: { name: string } | null;
}

export default async function NewDeliveryTripPage() {
  const supabase = createClient();
  const [labs, { data: dnData }] = await Promise.all([
    getLabs(),
    supabase
      .from("delivery_notes")
      .select("id, posting_date, naming_series, labs(name)")
      .order("posting_date", { ascending: false }),
  ]);

  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const dnOpts = ((dnData as unknown as DnRow[]) ?? []).map((d) => ({
    id: d.id,
    label: `${d.naming_series ?? "DN"} · ${d.labs?.name ?? "—"} · ${d.posting_date}`,
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/delivery-trips" className="hover:text-brand">← Delivery trips</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Delivery Trip</h1>
      <DeliveryTripForm labs={labOpts} deliveryNotes={dnOpts} />
    </div>
  );
}
