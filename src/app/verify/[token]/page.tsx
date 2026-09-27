import { ShieldCheckIcon, ShieldXIcon, ShieldQuestionIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { codesServerEnabled } from "@/lib/license/env";
import { openDoc, docValid } from "@/lib/license/doc-verify";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const money = (n: number, c?: string) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD", maximumFractionDigits: 2 }).format(n); } catch { return String(n); }
};

/**
 * Public check of a printed document's QR (on the codes server). Whoever
 * scans it sees whether the facts were signed by the company's own computers,
 * and the facts themselves to compare with the paper. No sign-in.
 */
export default async function VerifyPage({ params }: { params: { token: string } }) {
  const locale = getLocale();
  const token = decodeURIComponent(params.token);
  const facts = openDoc(token);
  let state: "valid" | "invalid" | "unknown" = "unknown";
  let company = "";
  if (facts && codesServerEnabled()) {
    try {
      const { codesDb } = await import("@/lib/license/server");
      const { licenses } = await codesDb();
      const row = await licenses.get(facts.l);
      if (row) {
        company = row.company;
        state = docValid(token, await licenses.verifyKey(row.id)) ? "valid" : "invalid";
      } else {
        state = "invalid";
      }
    } catch {
      state = "unknown";
    }
  } else if (!facts) {
    state = "invalid";
  }

  const Icon = state === "valid" ? ShieldCheckIcon : state === "invalid" ? ShieldXIcon : ShieldQuestionIcon;
  const tone = state === "valid" ? "bg-emerald-50 text-emerald-700" : state === "invalid" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800";
  return (
    <div className="grid min-h-screen place-items-center bg-surface-gray-1 p-4">
      <main className="w-full max-w-md rounded-2xl border border-outline-gray-2 bg-surface-white p-7 text-center shadow-sm" data-testid="verify" data-state={state}>
        <span className={`mx-auto grid size-14 place-items-center rounded-full ${tone}`}><Icon size={30} /></span>
        <div className="mt-3 text-lg font-bold text-ink-gray-9">
          {state === "valid" ? t(locale, "Genuine document") : state === "invalid" ? t(locale, "This document could not be verified") : t(locale, "Verification is not available right now")}
        </div>
        <p className="mt-1 text-sm text-ink-gray-6">
          {state === "valid"
            ? t(locale, "It was issued by the company below. Compare these details with the paper in your hand.")
            : state === "invalid"
              ? t(locale, "The QR does not match any company's records, or the document was altered. Ask the company that issued it.")
              : t(locale, "Try again later.")}
        </p>
        {state === "valid" && facts && (
          <dl className="mt-5 grid grid-cols-2 gap-y-2 border-t border-outline-gray-2 pt-4 text-start text-sm">
            <dt className="text-ink-gray-5">{t(locale, "Company")}</dt><dd className="font-semibold">{company}</dd>
            <dt className="text-ink-gray-5">{t(locale, "Document")}</dt><dd>{facts.k}</dd>
            <dt className="text-ink-gray-5">{t(locale, "Number")}</dt><dd className="font-mono" dir="ltr">{facts.n}</dd>
            <dt className="text-ink-gray-5">{t(locale, "Date")}</dt><dd className="tabular-nums" dir="ltr">{facts.d}</dd>
            {facts.p && <><dt className="text-ink-gray-5">{t(locale, "Addressed to")}</dt><dd>{facts.p}</dd></>}
            {facts.a != null && <><dt className="text-ink-gray-5">{t(locale, "Total")}</dt><dd className="tabular-nums" dir="ltr">{money(facts.a, facts.c)}</dd></>}
          </dl>
        )}
      </main>
    </div>
  );
}
