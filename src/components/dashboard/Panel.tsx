import type { ReactNode } from "react";
import Link from "next/link";
import { InboxIcon, PlusIcon } from "lucide-react";

export function Panel({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white shadow-sm">
      <header className="border-b border-outline-gray-1 bg-surface-gray-1/40 px-5 py-3 text-sm font-semibold text-ink-gray-7">
        {title}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

/**
 * Empty state for a list or panel.
 *
 * `hint` and the action turn a dead end into a starting point: the headline
 * says what is missing, the hint says why that is normal, and the button is
 * the obvious next step. Both are optional, so the 79 existing single-prop
 * call sites keep working unchanged.
 */
export function EmptyRow({
  text,
  hint,
  actionHref,
  actionLabel,
  icon,
}: {
  text: string;
  hint?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-gray-2 text-ink-gray-4">
        {icon ?? <InboxIcon size={20} />}
      </span>
      <p className="max-w-sm text-sm font-medium text-ink-gray-6">{text}</p>
      {hint && <p className="max-w-sm text-xs leading-relaxed text-ink-gray-5">{hint}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-brand-dark hover:shadow-md active:translate-y-0"
        >
          <PlusIcon size={15} /> {actionLabel}
        </Link>
      )}
    </div>
  );
}
