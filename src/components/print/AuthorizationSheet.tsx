import Link from "next/link";
import { PrintButton } from "./PrintButton";
import { getLocale } from "@/lib/i18n-server";
import { getBranding, brandingLines } from "@/lib/branding";
import { fmtDate, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

export interface AuthItem {
  description: string;
  qty: number;
  unit: string | null;
  serial_no: string | null;
}

export interface AuthDoc {
  auth_no: string;
  issue_date: string;
  valid_from: string;
  valid_to: string;
  addressed_to: string | null;
  bearer_name: string;
  bearer_id_no: string | null;
  bearer_phone: string | null;
  driver_name: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  from_governorate: string;
  to_governorate: string;
  destination: string | null;
  purpose: string | null;
  notes: string | null;
  status: string;
}

/**
 * A transport authorisation, printed as a letter rather than an invoice.
 *
 * It is carried and shown at checkpoints, so it reads as an official letter:
 * letterhead, a reference and date, who it is addressed to, a subject line, a
 * sentence stating plainly what is authorised, the manifest, the period of
 * validity, and a place for a signature and stamp. A cancelled one says so
 * across the page so a stale copy cannot be presented as current.
 */
export async function AuthorizationSheet({ doc, items }: { doc: AuthDoc; items: AuthItem[] }) {
  const locale = getLocale();
  const brand = await getBranding();
  const name = brand.companyName ?? "Spir-Margin";
  const contact = brandingLines(brand);
  const cancelled = doc.status === "cancelled";
  const watermark = cancelled
    ? t(locale, "CANCELLED")
    : brand.watermarkOn
      ? (brand.watermarkText ?? brand.companyName)
      : null;

  const Cell = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div>
        <span className="block text-[11px] uppercase tracking-wide text-ink-gray-4">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/authorizations`} className="text-sm text-ink-gray-5 hover:text-brand">
          <span aria-hidden>→</span> {t(locale, "Transport authorisations")}
        </Link>
        <PrintButton />
      </div>

      <div className="relative overflow-hidden rounded-lg border border-outline-gray-2 bg-white p-8 text-ink-gray-8 print:rounded-none print:border-0 print:p-0">
        {watermark ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 grid place-items-center overflow-hidden">
            <span
              className={`-rotate-45 whitespace-nowrap text-6xl font-black uppercase tracking-widest ${
                cancelled ? "text-red-600/15" : "text-ink-gray-8/[0.06] print:text-ink-gray-8/[0.08]"
              }`}
            >
              {watermark}
            </span>
          </div>
        ) : null}

        <div className="relative z-10">
          {/* Letterhead */}
          <div className="flex items-start justify-between gap-6 border-b-2 border-ink-gray-8 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 text-xl font-bold">
                {brand.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo} alt="" className="max-h-14 max-w-[8rem] object-contain" />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-white print:bg-brand">
                    {name.trim().charAt(0) || "S"}
                  </span>
                )}
                <span className="truncate">{name}</span>
              </div>
              {brand.tagline ? <p className="mt-1 text-xs text-ink-gray-5">{brand.tagline}</p> : null}
              {contact.map((l, i) => <p key={i} className="text-xs text-ink-gray-5">{l}</p>)}
            </div>
            <div className="shrink-0 text-end text-sm">
              <div className="text-xs uppercase tracking-wide text-ink-gray-4">{t(locale, "Reference")}</div>
              <div className="font-bold" dir="ltr">{doc.auth_no}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-ink-gray-4">{t(locale, "Date")}</div>
              <div className="font-medium">{fmtDate(doc.issue_date)}</div>
            </div>
          </div>

          {/* Addressee and subject */}
          <div className="py-5">
            {doc.addressed_to ? (
              <p className="text-sm">
                <span className="text-ink-gray-5">{t(locale, "To")}: </span>
                <span className="font-semibold">{doc.addressed_to}</span>
              </p>
            ) : null}
            <h1 className="mt-3 text-center text-lg font-bold underline underline-offset-4">
              {t(locale, "Subject: Transport authorisation")}
            </h1>
          </div>

          {/* The authorisation itself, stated in one sentence */}
          <p className="text-[15px] leading-8">
            {t(locale, "We, ")}
            <span className="font-bold">{name}</span>
            {t(locale, ", authorise the person named below to transport the equipment listed in this document from ")}
            <span className="font-bold">{doc.from_governorate}</span>
            {t(locale, " to ")}
            <span className="font-bold">{doc.to_governorate}</span>
            {doc.destination ? <>{t(locale, ", to ")}<span className="font-bold">{doc.destination}</span></> : null}
            {doc.purpose ? <>{t(locale, ", for the purpose of ")}<span className="font-bold">{doc.purpose}</span></> : null}
            {t(locale, ". This authorisation is valid from ")}
            <span className="font-bold">{fmtDate(doc.valid_from)}</span>
            {t(locale, " until ")}
            <span className="font-bold">{fmtDate(doc.valid_to)}</span>
            {t(locale, ". We ask that the necessary facilities be extended.")}
          </p>

          {/* Bearer and vehicle */}
          <div className="mt-5 grid grid-cols-3 gap-4 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-4 text-sm print:bg-surface-gray-1">
            <Cell label={t(locale, "Authorised person")} value={doc.bearer_name} />
            <Cell label={t(locale, "ID number")} value={doc.bearer_id_no} />
            <Cell label={t(locale, "Phone")} value={doc.bearer_phone} />
            <Cell label={t(locale, "Driver")} value={doc.driver_name} />
            <Cell label={t(locale, "Vehicle")} value={doc.vehicle_type} />
            <Cell label={t(locale, "Plate number")} value={doc.vehicle_plate} />
          </div>

          {/* Manifest */}
          <h2 className="mt-6 text-sm font-bold">{t(locale, "Equipment being moved")}</h2>
          <table className="mt-2 w-full border-collapse text-sm print:break-inside-auto">
            <thead className="print:table-header-group">
              <tr className="border-y border-outline-gray-3 text-start text-xs uppercase text-ink-gray-5">
                <th className="w-10 py-2 text-start">#</th>
                <th className="py-2 text-start">{t(locale, "Description")}</th>
                <th className="py-2 text-start">{t(locale, "Serial no.")}</th>
                <th className="py-2 text-end">{t(locale, "Qty")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-outline-gray-1 print:break-inside-avoid">
                  <td className="py-2 tabular-nums">{fmtNum(i + 1)}</td>
                  <td className="py-2 font-medium">{it.description}</td>
                  <td className="py-2 text-ink-gray-6" dir="ltr">{it.serial_no ?? "—"}</td>
                  <td className="py-2 text-end tabular-nums">
                    {fmtNum(it.qty, { maximumFractionDigits: 3 })} {it.unit ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {doc.notes ? (
            <div className="mt-5 border-t border-outline-gray-2 pt-3">
              <p className="text-xs uppercase tracking-wide text-ink-gray-4">{t(locale, "Notes")}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-gray-6">{doc.notes}</p>
            </div>
          ) : null}

          {/* Signature */}
          <div className="mt-12 flex justify-end">
            <div className="w-64 text-center">
              <div className="text-sm font-semibold">{t(locale, "Authorised signatory")}</div>
              <div className="mt-12 border-t border-ink-gray-8 pt-2 text-xs text-ink-gray-5">
                {t(locale, "Signature and stamp")}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-outline-gray-2 pt-4 text-center text-xs text-ink-gray-4">
            {brand.footerNote ?? `${name}${brand.phone ? " · " + brand.phone : ""}`}
          </div>
        </div>
      </div>
    </div>
  );
}
