import type { ReactNode } from "react";

/**
 * Two small, dependency-free charts for one series each (magnitude in the
 * brand hue, no legend — the title names the series): horizontal bars for
 * ranked items and columns for months. Thin marks with rounded data ends, a
 * value on hover (and always in the table under each chart), numbers in
 * Western digits.
 */

export interface Datum { label: string; value: number; href?: string; hint?: string }

export function BarList({ data, format, empty }: { data: Datum[]; format: (n: number) => string; empty: ReactNode }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max <= 0) return <div className="px-3 py-8 text-center text-sm text-ink-gray-5">{empty}</div>;
  return (
    <ul className="space-y-2.5 px-3 py-2" role="list">
      {data.map((d) => {
        const pct = Math.max(1.5, (d.value / max) * 100);
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink-gray-7" dir="auto">{d.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink-gray-8" dir="ltr">{format(d.value)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-gray-2" aria-hidden>
              <div className="h-2 rounded-full bg-brand transition-[width] group-hover:bg-brand-dark" style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={d.label} className="group" title={`${d.label}: ${format(d.value)}${d.hint ? ` — ${d.hint}` : ""}`} data-bar={d.label}>
            {d.href ? <a href={d.href} className="block hover:opacity-90">{row}</a> : row}
          </li>
        );
      })}
    </ul>
  );
}

export function Columns({ data, format, empty, height = 180 }: { data: Datum[]; format: (n: number) => string; empty: ReactNode; height?: number }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max <= 0) return <div className="px-3 py-8 text-center text-sm text-ink-gray-5">{empty}</div>;
  return (
    <div className="px-3 pb-2 pt-4" dir="ltr">
      <div className="flex items-end gap-1.5 border-b border-outline-gray-2" style={{ height }} role="list">
        {data.map((d) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * (height - 22)) : 0;
          return (
            <div key={d.label} role="listitem" className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${d.label}: ${format(d.value)}`} data-column={d.label}>
              <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md bg-ink-gray-9 px-2 py-1 text-[11px] font-semibold text-white shadow group-hover:block tabular-nums">
                {format(d.value)}
              </span>
              <div className="w-full max-w-[2.25rem] rounded-t-[4px] bg-brand group-hover:bg-brand-dark" style={{ height: h }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => <div key={d.label} className="flex-1 truncate text-center text-[10px] tabular-nums text-ink-gray-5">{d.label}</div>)}
      </div>
    </div>
  );
}

/** The same numbers as a table, for reading exact values and for screen readers. */
export function AsTable({ data, format, label, head }: { data: Datum[]; format: (n: number) => string; label: string; head: [string, string] }) {
  if (!data.length) return null;
  return (
    <details className="border-t border-outline-gray-1 px-3 py-2 text-xs">
      <summary className="cursor-pointer text-ink-gray-5 hover:text-brand">{label}</summary>
      <table className="mt-2 w-full">
        <thead><tr className="text-ink-gray-5"><th className="py-1 text-start font-medium">{head[0]}</th><th className="py-1 text-end font-medium">{head[1]}</th></tr></thead>
        <tbody className="divide-y divide-outline-gray-1">
          {data.map((d) => <tr key={d.label}><td className="py-1" dir="auto">{d.label}</td><td className="py-1 text-end tabular-nums" dir="ltr">{format(d.value)}</td></tr>)}
        </tbody>
      </table>
    </details>
  );
}
