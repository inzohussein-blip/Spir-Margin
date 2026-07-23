import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { AppNav } from "@/components/AppNav";
import { Awesomebar } from "@/components/desk/Awesomebar";
import { NewButton } from "@/components/desk/NewButton";
import { UserMenu } from "@/components/auth/UserMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/desk/NotificationBell";
import { LocaleProvider } from "@/components/LocaleProvider";
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
  // Focused pages keep auth but provide their own chrome (POS terminal, and the
  // customer portal, which must never show the staff desk shell).
  const isFocused =
    pathname === "/pos" || pathname.startsWith("/pos/") ||
    pathname === "/portal" || pathname.startsWith("/portal/");
  const user = isBare ? null : await getCurrentUser();
  const notifications = user && !isFocused ? await getNotifications(locale) : [];

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-surface-gray-1 text-ink-gray-8 antialiased">
        <LocaleProvider locale={locale}>
        {isBare || !user || isFocused ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-outline-gray-2 bg-surface-white/80 backdrop-blur-xl">
              <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold tracking-tight text-ink-gray-8">
                <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
                Spir-Margin
              </div>
              <AppNav locale={locale} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-outline-gray-2 bg-surface-white/85 px-6 shadow-sm backdrop-blur-xl">
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
        </LocaleProvider>
      </body>
    </html>
  );
}
