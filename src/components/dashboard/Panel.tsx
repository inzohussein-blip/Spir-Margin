import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";

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

export function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-gray-2 text-ink-gray-4">
        <InboxIcon size={20} />
      </span>
      <p className="max-w-sm text-sm text-ink-gray-5">{text}</p>
    </div>
  );
}
