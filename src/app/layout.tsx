import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spir-Margin — Medical Device & Lab Management",
  description:
    "Lightweight system for medical-device sales, lab tracking, spare parts, reagent kits and bank reconciliation.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-gray-1 text-ink-gray-8 antialiased">
        <div className="flex min-h-screen">
          <aside className="flex w-56 shrink-0 flex-col border-r border-outline-gray-2 bg-surface-white">
            <div className="flex items-center gap-2 px-5 py-4 text-lg font-semibold text-ink-gray-8">
              <span className="grid size-7 place-items-center rounded-md bg-brand text-white">S</span>
              Spir-Margin
            </div>
            <AppNav />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 items-center border-b border-outline-gray-2 bg-surface-white px-6 text-sm text-ink-gray-5">
              Medical device sales, lab tracking &amp; banking
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
