import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { AppNav } from "@/components/AppNav";
import { Awesomebar } from "@/components/desk/Awesomebar";
import { NewButton } from "@/components/desk/NewButton";
import { UserMenu } from "@/components/auth/UserMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/desk/NotificationBell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getNotifications } from "@/lib/notifications";
import { getLocale } from "@/lib/i18n-server";
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
  const locale = getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  // The login page renders standalone — no sidebar/header shell.
  const isBare = pathname === "/login" || pathname.startsWith("/login/");
  const user = isBare ? null : await getCurrentUser();
  const notifications = user ? await getNotifications(locale) : [];

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-surface-gray-1 text-ink-gray-8 antialiased">
        {isBare || !user ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-e border-outline-gray-2 bg-surface-white">
              <div className="flex items-center gap-2 px-5 py-4 text-lg font-semibold text-ink-gray-8">
                <span className="grid size-7 place-items-center rounded-md bg-brand text-white">S</span>
                Spir-Margin
              </div>
              <AppNav locale={locale} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print flex h-12 items-center justify-between gap-4 border-b border-outline-gray-2 bg-surface-white px-6">
                <div className="flex items-center gap-3">
                  <NewButton locale={locale} />
                  <Awesomebar locale={locale} />
                </div>
                <div className="flex items-center gap-3">
                  <NotificationBell items={notifications} locale={locale} />
                  <LanguageSwitcher locale={locale} />
                  <UserMenu user={user} locale={locale} />
                </div>
              </header>
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
