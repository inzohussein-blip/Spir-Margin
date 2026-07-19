import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Lab {
  id: string; code: string; name: string; status: string;
  city: string | null; address: string | null; contact_name: string | null; phone: string | null; email: string | null;
}
interface Inv { id: string; invoice_no: string; posting_date: string; status: string; total_amount: number; outstanding: number; }
interface Dev { id: string; asset_code: string; serial_no: string | null; status: string; products: { name: string } | null; }

export default async function LabDetailPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data: labData } = await supabase
    .from("labs").select("id, code, name, status, city, address, contact_name, phone, email").eq("id", params.id).single();
  const lab = labData as unknown as Lab | null;
  if (!lab) notFound();

  const [{ data: invData }, { data: devData }] = await Promise.all([
    supabase.from("sales_invoices").select("id, invoice_no, posting_date, status, total_amount, outstanding").eq("lab_id", params.id).order("posting_date", { ascending: false }),
    supabase.from("devices").select("id, asset_code, serial_no, status, products(name)").eq("lab_id", params.id).order("asset_code"),
  ]);
  const invoices = (invData as unknown as Inv[]) ?? [];
  const devices = (devData as unknown as Dev[]) ?? [];
  const billed = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const outstanding = invoices.reduce((s, i) => s + Number(i.outstanding), 0);

  const info: [string, string | null][] = [
    [t(locale, "Code"), lab.code],
    [t(locale, "City"), lab.city],
    [t(locale, "Address"), lab.address],
    [t(locale, "Contact"), lab.contact_name],
    [t(locale, "Phone"), lab.phone],
    [t(locale, "Email"), lab.email],
  ];

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5"><Link href="/labs" className="hover:text-brand">← {t(locale, "Labs")}</Link></div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{lab.name}</h1>
          <p className="text-sm text-ink-gray-5">{lab.code}</p>
        </div>
        <Indicator status={lab.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Total billed")} value={money(billed)} accent="brand" />
        <StatCard label={t(locale, "Total outstanding")} value={money(outstanding)} accent="amber" />
        <StatCard label={t(locale, "Devices")} value={String(devices.length)} accent="green" />
      </div>

      <Panel title={t(locale, "Details")}>
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          {info.map(([k, v]) => (
            <div key={k}><dt className="text-ink-gray-4">{k}</dt><dd className="font-medium text-ink-gray-8">{v || "—"}</dd></div>
          ))}
        </dl>
      </Panel>

      <Panel title={`${t(locale, "Sales invoices")} (${invoices.length})`}>
        {invoices.length === 0 ? <EmptyRow text={t(locale, "No invoices yet")} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Invoice")}</th><th className="px-4 py-2">{t(locale, "Date")}</th>
              <th className="px-4 py-2">{t(locale, "Status")}</th><th className="px-4 py-2 text-end">{t(locale, "Amount")}</th><th className="px-4 py-2 text-end">{t(locale, "Outstanding")}</th>
            </tr></thead>
            <tbody className="divide-y divide-outline-gray-1">
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium"><Link href={`/sales-invoices/${i.id}`} className="text-brand hover:underline">{i.invoice_no}</Link></td>
                  <td className="px-4 py-2 text-ink-gray-5">{i.posting_date}</td>
                  <td className="px-4 py-2"><Indicator status={i.status} /></td>
                  <td className="px-4 py-2 text-end">{money(Number(i.total_amount))}</td>
                  <td className="px-4 py-2 text-end">{money(Number(i.outstanding))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={`${t(locale, "Devices")} (${devices.length})`}>
        {devices.length === 0 ? <EmptyRow text={t(locale, "No devices yet")} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Code")}</th><th className="px-4 py-2">{t(locale, "Product")}</th>
              <th className="px-4 py-2">{t(locale, "Serial no.")}</th><th className="px-4 py-2">{t(locale, "Status")}</th>
            </tr></thead>
            <tbody className="divide-y divide-outline-gray-1">
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">{d.asset_code}</td>
                  <td className="px-4 py-2">{d.products?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{d.serial_no ?? "—"}</td>
                  <td className="px-4 py-2"><Indicator status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
