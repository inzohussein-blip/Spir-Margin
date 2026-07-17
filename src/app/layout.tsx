import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { AppNav } from "@/components/AppNav";
import { Awesomebar } from "@/components/desk/Awesomebar";
import { UserMenu } from "@/components/auth/UserMenu";
import { getCurrentUser } from "@/lib/auth/current-user";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spir-Margin — Medical Device & Lab Management",
  description:
    "Lightweight system for medical-device sales, lab tracking, spare parts, reagent kits and bank reconciliation.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = headers().get("x-pathname") ?? "";
  // The login page renders standalone — no sidebar/header shell.
  const isBare = pathname === "/login" || pathname.startsWith("/login/");
  const user = isBare ? null : await getCurrentUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-gray-1 text-ink-gray-8 antialiased">
        {isBare || !user ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-outline-gray-2 bg-surface-white">
              <div className="flex items-center gap-2 px-5 py-4 text-lg font-semibold text-ink-gray-8">
                <span className="grid size-7 place-items-center rounded-md bg-brand text-white">S</span>
                Spir-Margin
              </div>
              <AppNav />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print flex h-12 items-center justify-between gap-4 border-b border-outline-gray-2 bg-surface-white px-6">
                <Awesomebar />
                <UserMenu user={user} />
              </header>
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
