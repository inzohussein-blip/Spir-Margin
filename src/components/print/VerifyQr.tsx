import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { docVerifyUrl } from "@/lib/license/device";
import type { DocFacts } from "@/lib/license/doc-verify";

/**
 * The QR on a printed document: anyone can scan it and the codes server's
 * /verify page says whether these facts were signed by the company's own
 * computers. Signed here, with no internet needed; nothing when codes are off.
 */
export async function VerifyQr({ facts }: { facts: DocFacts }) {
  const locale = getLocale();
  const url = await docVerifyUrl(facts);
  if (!url) return null;
  const svg = await import("qrcode").then((q) => q.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" })).catch(() => null);
  if (!svg) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-ink-gray-4" data-testid="verify-qr" data-href={url}>
      <span className="block size-16" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="max-w-[7rem] leading-snug">{t(locale, "Scan to check this document is genuine")}</span>
    </div>
  );
}
