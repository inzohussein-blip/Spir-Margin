import Link from "next/link";
import type { ReactNode } from "react";
import { InfoIcon, TriangleAlertIcon, ChevronLeftIcon, type LucideIcon } from "lucide-react";

/**
 * Building blocks for the Instructions pages. Plain server components: the
 * instructions must read (and print) without any script running.
 */

/** A titled card holding one topic. */
export function HelpSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id?: string;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-outline-gray-2 bg-surface-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-gray-8">
        {Icon ? <Icon size={17} className="shrink-0 text-brand" /> : null}
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-7 text-ink-gray-7">{children}</div>
    </section>
  );
}

/** Numbered steps, in order. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 ps-5 marker:font-semibold marker:text-brand">{children}</ol>;
}

/** A plain bulleted list. */
export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 ps-5 marker:text-ink-gray-4">{children}</ul>;
}

/** A highlighted remark: "info" for a tip, "warn" for something that can lose data. */
export function Note({ kind = "info", children }: { kind?: "info" | "warn"; children: ReactNode }) {
  const warn = kind === "warn";
  const Icon = warn ? TriangleAlertIcon : InfoIcon;
  return (
    <div
      className={`flex gap-2.5 rounded-md border px-3.5 py-2.5 ${
        warn ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-ink-gray-8"
      }`}
    >
      <Icon size={16} className={`mt-1 shrink-0 ${warn ? "text-amber-600" : "text-brand"}`} />
      <div>{children}</div>
    </div>
  );
}

/**
 * A file name, command or address. Always left-to-right, so a command such as
 * `install-windows.cmd -Update` reads in its real order inside Arabic text.
 */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code dir="ltr" className="rounded bg-surface-gray-2 px-1.5 py-0.5 font-mono text-[0.85em] text-ink-gray-8">
      {children}
    </code>
  );
}

/** A key on the keyboard. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd dir="ltr" className="rounded border border-outline-gray-2 bg-surface-white px-1.5 py-0.5 font-mono text-[0.8em] text-ink-gray-7 shadow-sm">
      {children}
    </kbd>
  );
}

/**
 * Where something is on screen, written the way it appears in the app:
 * «الإعداد ← الإعدادات ← النسخ الاحتياطي». With an href, it is a link there.
 */
export function UiPath({ parts, href }: { parts: string[]; href?: string }) {
  const body = (
    <span className="inline-flex flex-wrap items-center gap-1 font-medium text-ink-gray-8">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 ? <ChevronLeftIcon size={13} className="text-ink-gray-4" /> : null}
          {p}
        </span>
      ))}
    </span>
  );
  if (!href) return <span className="rounded bg-surface-gray-1 px-1.5 py-0.5">{body}</span>;
  return (
    <Link href={href} className="rounded bg-surface-gray-1 px-1.5 py-0.5 hover:bg-brand-light hover:text-brand">
      {body}
    </Link>
  );
}

/** A two-column "what / meaning" table. */
export function Pairs({ rows, head }: { rows: [ReactNode, ReactNode][]; head?: [string, string] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-outline-gray-1">
      <table className="w-full text-sm">
        {head ? (
          <thead className="bg-surface-gray-1 text-xs text-ink-gray-5">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{head[0]}</th>
              <th className="px-3 py-2 text-start font-medium">{head[1]}</th>
            </tr>
          </thead>
        ) : null}
        <tbody className="divide-y divide-outline-gray-1">
          {rows.map(([a, b], i) => (
            <tr key={i} className="align-top">
              <td className="w-1/3 px-3 py-2 font-medium text-ink-gray-8">{a}</td>
              <td className="px-3 py-2 text-ink-gray-7">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
