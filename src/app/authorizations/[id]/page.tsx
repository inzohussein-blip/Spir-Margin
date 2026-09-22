import Link from "next/link";
import { notFound } from "next/navigation";
import { PrinterIcon, BanIcon, CopyIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { cancelAuthorization, reissueAuthorization } from "@/app/actions/authorization";
import { getLocale } from "@/lib/i18n-server";
import { fmtDate, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Doc {
  id: string; auth_no: string; issue_date: string; valid_from: string; valid_to: string;
  addressed_to: string | null; bearer_name: string; bearer_id_no: string | null;
  bearer_phone: string | null; driver_name: string | null; vehicle_type: string | null;
  vehicle_plate: string | null; from_governorate: string; to_governorate: string;
  destination: string | null; purpose: string | null; notes: string | null;
  status: string; created_by: string | null;
}
interface Item { id: string; description: string; qty: number; unit: string | null; serial_no: string | null; }

export default async function AuthorizationPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("transport_authorizations")
    .select("id, auth_no, issue_date, valid_from, valid_to, addressed_to, bearer_name, bearer_id_no, bearer_phone, driver_name, vehicle_type, vehicle_plate, from_governorate, to_governorate, destination, purpose, notes, status, created_by")
    .eq("id", params.id)
    .single();
  const doc = data as unknown as Doc | null;
  if (!doc) notFound();

  const { data: itemRows } = await supabase
    .from("transport_authorization_items")
    .select("id, description, qty, unit, serial_no, line_no")
    .eq("auth_id", doc.id)
    .order("line_no");
  const items = (itemRows as unknown as Item[]) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const expired = doc.status === "issued" && doc.valid_to < today;
  const label = doc.status === "cancelled" ? "cancelled" : expired ? "expired" : "issued";

  const Row = ({ label: l, value }: { label: string; value: string | null }) =>
    value ? (
      <div>
        <dt className="text-xs uppercase tracking-wide text-ink-gray-4">{l}</dt>
        <dd className="mt-0.5 font-medium">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-gray-5">
        <Link href="/authorizations" className="hover:text-brand">
          <span aria-hidden>→</span> {t(locale, "Transport authorisations")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8" dir="ltr">{doc.auth_no}</h1>
          <p className="text-sm text-ink-gray-5">
            {doc.from_governorate} ← {doc.to_governorate} · {fmtDate(doc.issue_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Indicator status={doc.status === "cancelled" ? "inactive" : expired ? "pending" : "active"} label={t(locale, label)} />
          <Link
            href={`/authorizations/${doc.id}/print`}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            <PrinterIcon size={15} /> {t(locale, "Print the authorisation")}
          </Link>
        </div>
      </div>

      {expired ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t(locale, "This authorisation's period has passed. Issue a new one rather than presenting this.")}
        </div>
      ) : null}

      <Panel title={t(locale, "Details")}>
        <dl className="grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3">
          <Row label={t(locale, "Authorised person")} value={doc.bearer_name} />
          <Row label={t(locale, "ID number")} value={doc.bearer_id_no} />
          <Row label={t(locale, "Phone")} value={doc.bearer_phone} />
          <Row label={t(locale, "Driver")} value={doc.driver_name} />
          <Row label={t(locale, "Vehicle")} value={doc.vehicle_type} />
          <Row label={t(locale, "Plate number")} value={doc.vehicle_plate} />
          <Row label={t(locale, "Destination (lab or hospital)")} value={doc.destination} />
          <Row label={t(locale, "Addressed to")} value={doc.addressed_to} />
          <Row label={t(locale, "Purpose")} value={doc.purpose} />
          <Row label={t(locale, "Valid from")} value={fmtDate(doc.valid_from)} />
          <Row label={t(locale, "Valid to")} value={fmtDate(doc.valid_to)} />
          <Row label={t(locale, "Issued by")} value={doc.created_by} />
        </dl>
      </Panel>

      <Panel title={`${t(locale, "Equipment being moved")} (${fmtNum(items.length)})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Description")}</th>
                <th className="px-4 py-2">{t(locale, "Serial no.")}</th>
                <th className="px-4 py-2 text-end">{t(locale, "Qty")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2 font-medium">{i.description}</td>
                  <td className="px-4 py-2 text-ink-gray-5" dir="ltr">{i.serial_no ?? "—"}</td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {fmtNum(i.qty, { maximumFractionDigits: 3 })} {i.unit ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {doc.notes ? (
        <Panel title={t(locale, "Notes")}>
          <p className="whitespace-pre-line p-4 text-sm text-ink-gray-6">{doc.notes}</p>
        </Panel>
      ) : null}

      <form action={reissueAuthorization} className="inline-block">
        <input type="hidden" name="id" value={doc.id} />
        <button className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand">
          <CopyIcon size={15} /> {t(locale, "Issue the same journey again")}
        </button>
      </form>

      {doc.status === "issued" ? (
        <form action={cancelAuthorization} className="inline-block ms-2">
          <input type="hidden" name="id" value={doc.id} />
          <button className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-red-300 hover:text-red-700">
            <BanIcon size={15} /> {t(locale, "Cancel this authorisation")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
