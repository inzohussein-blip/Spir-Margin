"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { recall, remember } from "@/lib/remember";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * A dropdown's options with the ones this person picked last on top — the
 * few customers, suppliers or warehouses used every day, without scrolling
 * past the rest. Nothing is chosen for them: a wrong customer on an invoice
 * costs more than a scroll.
 */

const MAX = 5;

function read(kind: string): string[] {
  try {
    const v = JSON.parse(recall(`recent.${kind}`) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Note a pick, most recent first. */
export function noteRecent(kind: string, id: string): void {
  if (!id) return;
  remember(`recent.${kind}`, JSON.stringify([id, ...read(kind).filter((x) => x !== id)].slice(0, MAX)));
}

export function RecentOptions({ kind, options }: { kind: string; options: { id: string; label: string }[] }) {
  const locale = useLocale();
  // Read after hydration: the server does not know this browser's picks.
  const [recent, setRecent] = useState<string[]>([]);
  // Moving options between groups replaces them, and a select whose chosen
  // option is replaced forgets the choice (a copied document's customer):
  // keep it across the change.
  const select = useRef<HTMLSelectElement | null>(null);
  const chosen = useRef<string | null>(null);
  const anchor = (el: HTMLOptionElement | null) => {
    if (el) select.current = el.closest("select");
  };
  useEffect(() => {
    chosen.current = select.current?.value ?? null;
    setRecent(read(kind));
  }, [kind]);
  useLayoutEffect(() => {
    if (select.current && chosen.current) select.current.value = chosen.current;
  }, [recent]);

  const byId = new Map(options.map((o) => [o.id, o]));
  const top = recent.map((id) => byId.get(id)).filter((o): o is { id: string; label: string } => !!o);
  if (!top.length) {
    return <>{options.map((o, i) => <option key={o.id} ref={i === 0 ? anchor : undefined} value={o.id}>{o.label}</option>)}</>;
  }
  const topIds = new Set(top.map((o) => o.id));
  return (
    <>
      <optgroup label={t(locale, "Used recently")}>
        {top.map((o, i) => <option key={`r-${o.id}`} ref={i === 0 ? anchor : undefined} value={o.id}>{o.label}</option>)}
      </optgroup>
      <optgroup label={t(locale, "All")}>
        {options.filter((o) => !topIds.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </optgroup>
    </>
  );
}
