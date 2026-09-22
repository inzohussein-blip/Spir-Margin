import type { ReactNode } from "react";
import Link from "next/link";
import { PrintButton } from "./PrintButton";
import { getLocale } from "@/lib/i18n-server";
import { getBranding, brandingLines } from "@/lib/branding";
import { t } from "@/lib/i18n";

export interface PartyBlock {
  heading: string;
  name: string;
  lines?: (string | null | undefined)[];
}

export interface DocLine {
  label: string;
  sub?: string | null;
  qty: number;
  rate: number;
  amount: number;
}

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);

/**
 * Clean, printable A4-style document (invoice / quotation / order / delivery note).
 * The app shell is hidden on print via the `.no-print` / print:hidden classes.
 */
export async function DocumentSheet({
  docType,
  docNo,
  date,
  backHref,
  parties,
  lines,
  currency = "USD",
  totals,
  meta,
  notes,
  footer,
}: {
  docType: string;
  docNo: string;
  date: string;
  backHref: string;
  parties: PartyBlock[];
  lines: DocLine[];
  currency?: string;
  totals: { label: string; value: number; strong?: boolean }[];
  meta?: { label: string; value: ReactNode }[];
  notes?: string | null;
  footer?: ReactNode;
}) {
  const locale = getLocale();
  const brand = await getBranding();
  const name = brand.companyName ?? "Spir-Margin";
  const contact = brandingLines(brand);
  const watermark = brand.watermarkOn ? (brand.watermarkText ?? brand.companyName) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={backHref} className="text-sm text-ink-gray-5 hover:text-brand"><span aria-hidden>→</span> {t(locale, "Back")}</Link>
        <PrintButton />
      </div>

      <div className="relative overflow-hidden rounded-lg border border-outline-gray-2 bg-white p-8 text-ink-gray-8 print:rounded-none print:border-0 print:p-0">
        {/* Watermark. Behind everything and non-interactive, so it never
            covers a figure someone has to read. */}
        {watermark ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 grid place-items-center overflow-hidden"
          >
            <span className="-rotate-45 whitespace-nowrap text-6xl font-black uppercase tracking-widest text-ink-gray-8/[0.06] print:text-ink-gray-8/[0.08]">
              {watermark}
            </span>
          </div>
        ) : null}

        <div className="relative z-10">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-6 border-b border-outline-gray-2 pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-xl font-bold">
              {brand.logo ? (
                // A data URI held on this machine, so a plain <img> is right
                // here — next/image would try to optimise something local.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo} alt="" className="max-h-12 max-w-[7rem] object-contain" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand text-white print:bg-brand">
                  {name.trim().charAt(0) || "S"}
                </span>
              )}
              <span className="truncate">{name}</span>
            </div>
            {brand.tagline ? (
              <p className="mt-1 text-xs text-ink-gray-5">{brand.tagline}</p>
            ) : brand.companyName ? null : (
              <p className="mt-1 text-xs text-ink-gray-5">{t(locale, "Medical devices · lab supplies · reagent kits")}</p>
            )}
            {contact.map((line, i) => (
              <p key={i} className="text-xs text-ink-gray-5">{line}</p>
            ))}
          </div>
          <div className="shrink-0 text-end">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-ink-gray-9">{docType}</h1>
            <p className="mt-1 text-sm font-medium">{docNo}</p>
            <p className="text-xs text-ink-gray-5">{date}</p>
          </div>
        </div>

        {/* Parties + meta */}
        <div className="grid grid-cols-2 gap-6 py-6">
          {parties.map((p, i) => (
            <div key={i}>
              <p className="text-xs uppercase tracking-wide text-ink-gray-4">{p.heading}</p>
              <p className="mt-1 font-semibold">{p.name}</p>
              {(p.lines ?? []).filter(Boolean).map((l, j) => (
                <p key={j} className="text-sm text-ink-gray-6">{l}</p>
              ))}
            </div>
          ))}
        </div>

        {meta && meta.length > 0 ? (
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-surface-gray-1 p-3 text-sm print:bg-surface-gray-1">
            {meta.map((m, i) => (
              <div key={i}>
                <span className="block text-xs text-ink-gray-4">{m.label}</span>
                <span className="font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Lines */}
        <table className="w-full text-sm print:break-inside-auto">
          <thead className="print:table-header-group">
            <tr className="border-b-2 border-outline-gray-3 text-start text-xs uppercase text-ink-gray-5">
              <th className="py-2">{t(locale, "Item")}</th>
              <th className="py-2 text-end">{t(locale, "Qty")}</th>
              <th className="py-2 text-end">{t(locale, "Rate")}</th>
              <th className="py-2 text-end">{t(locale, "Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-outline-gray-1 print:break-inside-avoid">
                <td className="py-2">
                  <span className="font-medium">{l.label}</span>
                  {l.sub ? <span className="block text-xs text-ink-gray-4">{l.sub}</span> : null}
                </td>
                <td className="py-2 text-end">{l.qty}</td>
                <td className="py-2 text-end">{money(l.rate, currency)}</td>
                <td className="py-2 text-end">{money(l.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <table className="w-64 text-sm">
            <tbody>
              {totals.map((t, i) => (
                <tr key={i} className={t.strong ? "border-t-2 border-outline-gray-3" : ""}>
                  <td className={`py-1.5 ${t.strong ? "font-bold" : "text-ink-gray-6"}`}>{t.label}</td>
                  <td className={`py-1.5 text-end ${t.strong ? "text-lg font-bold" : ""}`}>{money(t.value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {notes ? (
          <div className="mt-6 border-t border-outline-gray-2 pt-4">
            <p className="text-xs uppercase tracking-wide text-ink-gray-4">{t(locale, "Notes")}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-gray-6">{notes}</p>
          </div>
        ) : null}

        <div className="mt-8 border-t border-outline-gray-2 pt-4 text-center text-xs text-ink-gray-4">
          {footer ?? brand.footerNote ?? `${t(locale, "Thank you for your business")} — ${name}`}
        </div>
        </div>
      </div>
    </div>
  );
}
