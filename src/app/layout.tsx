import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedDevice — Medical Device & Lab Management",
  description:
    "Lightweight system for medical-device sales, lab tracking, spare parts and reagent kits.",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/labs", label: "Labs" },
  { href: "/devices", label: "Devices" },
  { href: "/kits", label: "Kits" },
  { href: "/products", label: "Products" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/companies", label: "Companies" },
  { href: "/purchases", label: "Purchases" },
  { href: "/banking", label: "Banking" },
];

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
            <div className="px-5 py-5 text-lg font-bold text-brand">
              🩺 MedDevice
            </div>
            <nav className="flex flex-col gap-1 px-3">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
