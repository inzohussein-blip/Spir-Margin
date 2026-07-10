import type { ReactNode } from "react";

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-outline-gray-2 bg-surface-white shadow-sm">
      <header className="border-b border-outline-gray-1 px-5 py-3 text-sm font-semibold text-ink-gray-7">
        {title}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-sm text-ink-gray-4">{text}</div>;
}
