import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { codesDb, codesServerEnabled, getContact } from "@/lib/license/server";
import { isOwner } from "@/lib/license/owner";
import { STATIONS } from "@/lib/license/modules";
import { receiptNo } from "@/lib/license/panel";
import { PROVIDER_PHONE } from "@/lib/license/provider";
import { PrintButton } from "@/components/print/PrintButton";

/** A payment receipt for a code, printable (the owner's page links here once a code is marked paid). */
export const dynamic = "force-dynamic";

const day = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  if (!codesServerEnabled()) notFound();
  if (!(await isOwner())) redirect("/licenses");
  const { licenses } = await codesDb();
  const r = await licenses.get(params.id);
  if (!r || !r.paid) notFound();
  const locale = getLocale();
  const T = (k: string) => t(locale, k);
  const contact = (await getContact().catch(() => "")) || PROVIDER_PHONE;
  const rows: [string, string][] = [
    [T("Company"), r.company],
    [T("Code"), `…${r.code_hint}`],
    [T("Period"), r.expires_at ? `${day(r.activated_at)} → ${day(r.expires_at)}` : `${r.duration_days} ${T("days from the first computer")}`],
    [T("Computers"), String(r.seats)],
    [T("Stations"), STATIONS.filter((s) => r.modules.includes(s.id)).map((s) => T(s.label)).join("، ")],
  ];
  return (
    <div className="min-h-screen bg-surface-gray-1 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-xl space-y-4 px-4">
        <div className="no-print flex justify-end"><PrintButton label={T("Print / Save PDF")} /></div>
        <article data-testid="receipt" className="rounded-2xl border border-outline-gray-2 bg-surface-white p-8 shadow-sm print:border-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b border-outline-gray-2 pb-4">
            <div>
              <h1 className="text-xl font-bold text-ink-gray-9">{T("Payment receipt")}</h1>
              <p className="mt-1 text-sm text-ink-gray-5">Spir-Margin</p>
            </div>
            <div className="text-end text-sm">
              <div dir="ltr" className="font-mono font-semibold" data-receipt-no>{receiptNo(r)}</div>
              <div dir="ltr" className="tabular-nums text-ink-gray-5">{day(r.paid_at)}</div>
            </div>
          </header>
          <dl className="mt-4 divide-y divide-outline-gray-1 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-ink-gray-5">{k}</dt><dd className="text-end font-medium text-ink-gray-8">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-gray-1 px-4 py-3">
            <span className="font-semibold text-ink-gray-7">{T("Amount received")}</span>
            <span className="text-lg font-bold tabular-nums text-ink-gray-9" data-amount>{r.price || "—"}</span>
          </div>
          <footer className="mt-6 text-center text-xs text-ink-gray-5">{T("For help")}: <span dir="ltr">{contact}</span></footer>
        </article>
      </div>
    </div>
  );
}
