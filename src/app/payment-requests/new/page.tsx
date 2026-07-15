import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getModesOfPayment } from "@/lib/queries";
import { PaymentRequestForm } from "@/components/accounting/PaymentRequestForm";

export const dynamic = "force-dynamic";

interface InvRow {
  id: string;
  invoice_no: string;
  lab_id: string | null;
  outstanding: number;
  labs: { name: string } | null;
}

export default async function NewPaymentRequestPage() {
  const supabase = createClient();
  const [{ data: invData }, modes] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, invoice_no, lab_id, outstanding, labs:lab_id(name)")
      .in("status", ["unpaid", "partly_paid"])
      .order("posting_date", { ascending: false }),
    getModesOfPayment(),
  ]);

  const invoices = ((invData as unknown as InvRow[]) ?? []).map((i) => ({
    id: i.id,
    label: `${i.invoice_no}${i.labs?.name ? ` — ${i.labs.name}` : ""} (${Number(i.outstanding).toLocaleString()})`,
    lab_id: i.lab_id,
    outstanding: Number(i.outstanding),
  }));
  const modeOpts = modes.map((m) => ({ id: m.id as string, label: m.name as string }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/payment-requests" className="hover:text-brand">← Payment requests</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Payment Request</h1>
      <PaymentRequestForm invoices={invoices} modes={modeOpts} />
    </div>
  );
}
