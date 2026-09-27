"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, PackageIcon } from "lucide-react";
import { kitHintsAction } from "@/app/actions/kits-hint";
import type { KitHint as Hint } from "@/lib/kits";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { useDataActions } from "@/components/data/DataActions";

// One request per page per source, shared by every line of the form.
const pending = new Map<() => Promise<Record<string, Hint>>, Promise<Record<string, Hint>>>();
function loadHints(source: () => Promise<Record<string, Hint>>): Promise<Record<string, Hint>> {
  let p = pending.get(source);
  if (!p) {
    p = source().catch(() => ({}));
    pending.set(source, p);
  }
  return p;
}

/** Under a sale line's product: the kit batch it will be taken from, and a warning near expiry. */
export function KitHint({ productId }: { productId: string | null | undefined }) {
  const locale = useLocale();
  const [hints, setHints] = useState<Record<string, Hint> | null>(null);
  const source = useDataActions().kitHints ?? kitHintsAction;
  useEffect(() => {
    let live = true;
    loadHints(source).then((h) => live && setHints(h));
    return () => {
      live = false;
    };
  }, [source]);
  const h = productId ? hints?.[productId] : undefined;
  if (!h) return null;
  const cls =
    h.level === "expired" ? "text-red-700" : h.level === "soon" ? "text-amber-700" : "text-ink-gray-5";
  return (
    <span data-kit-hint={h.level} className={`mt-1 flex items-center gap-1 text-[11px] ${cls}`}>
      {h.level === "ok" ? <PackageIcon size={11} /> : <AlertTriangleIcon size={11} />}
      <span>
        {t(locale, "Taken first from batch")} <span dir="ltr">{h.batchNo}</span>
        {h.expiry ? (
          <>
            {" · "}
            {h.level === "expired"
              ? `${t(locale, "expired … days ago")} ${-(h.days ?? 0)} ${t(locale, "days ago")}`
              : `${t(locale, "expires in")} ${h.days} ${t(locale, "days")}`}{" "}
            (<span dir="ltr">{h.expiry}</span>)
          </>
        ) : null}
      </span>
    </span>
  );
}
