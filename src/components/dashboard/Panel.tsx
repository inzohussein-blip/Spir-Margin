import type { ReactNode } from "react";

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
        {title}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-sm text-slate-400">{text}</div>;
}
