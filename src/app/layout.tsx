import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { MobileSidebar } from "@/components/MobileSidebar";
import { Awesomebar } from "@/components/desk/Awesomebar";
import { NewButton } from "@/components/desk/NewButton";
import { UserMenu } from "@/components/auth/UserMenu";
import { NotificationBell } from "@/components/desk/NotificationBell";
import { LocaleProvider } from "@/components/LocaleProvider";
import { NavProgress } from "@/components/NavProgress";
import { OfflineProvider } from "@/components/offline/OfflineProvider";
import { SyncStatus } from "@/components/offline/SyncStatus";
import { DbSyncStatus } from "@/components/offline/DbSyncStatus";
import { ServiceWorkerRegistrar } from "@/components/offline/ServiceWorkerRegistrar";
import { ErrorReporter } from "@/components/monitoring/ErrorReporter";
import { Toasts } from "@/components/desk/Toasts";
import { FeatureUnavailable } from "@/components/settings/FeatureUnavailable";
import { readSession } from "@/lib/auth/current-user";
import { getNotifications } from "@/lib/notifications";
import { updateAvailable } from "@/lib/update/updates";
import { currentCopyState } from "@/lib/backup/copies-server";
import { getAccessContext, blockReason, navFeatureState } from "@/lib/features";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import "./globals.css";

// The title is what the installed app's window and taskbar button show.
export const metadata: Metadata = {
  title: "Spir-Margin — إدارة الأجهزة الطبية والمختبرات",
  description:
    "نظام لمبيعات الأجهزة الطبية، ومتابعة المختبرات، وقطع الغيار، وكِتّات الكواشف، والتسوية المصرفية.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = headers().get("x-pathname") ?? "";
  const locale = getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  // The login page and platform picker render standalone — no sidebar/header shell.
  const isBare =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/");
  // Focused pages keep auth but provide their own chrome (POS terminal, and the
  // customer portal, which must never show the staff desk shell).
  const isFocused =
    pathname === "/pos" || pathname.startsWith("/pos/") ||
    pathname === "/portal" || pathname.startsWith("/portal/");
  const session = isBare ? null : await readSession();
  // The middleware can only check the cookie's signature. A session that the
  // server has since ended (password reset, account disabled) is sent to be
  // cleared, and the person signs in again.
  if (session?.ended) redirect(`/login/expired?next=${encodeURIComponent(pathname || "/")}`);
  const user = session?.user ?? null;
  const notifications = user && !isFocused ? await getNotifications(locale) : [];
  // A new release, for whoever can install it (Settings → Updates).
  const release = user?.role === "admin" && !isFocused ? updateAvailable() : null;
  // The records on this computer alone, with no recent copy anywhere else.
  const copies = user?.role === "admin" && !isFocused && !process.env.VERCEL ? await currentCopyState() : null;
  if (copies?.atRisk) {
    notifications.unshift({
      title: t(locale, "The company's records are on this computer only"),
      sub: copies.daysSince === null
        ? t(locale, "No copy anywhere else yet. Link a second computer, or back up to another drive.")
        : `${t(locale, "Newest copy elsewhere")}: ${copies.daysSince} ${t(locale, "days")}`,
      href: "/help?tab=backup",
      severity: "amber",
    });
  }
  if (release) {
    notifications.unshift({
      title: `${t(locale, "A new release is available")}: ${t(locale, "Release")} ${release.number}`,
      sub: t(locale, "Install it from Settings"),
      href: "/settings#updates",
      severity: "blue",
    });
  }

  // Feature availability (admins bypass; core features are always on).
  const showShell = !isBare && !!user && !isFocused;
  const access = showShell ? await getAccessContext(user!) : null;
  const nav = access ? navFeatureState(access) : { hidden: [], off: [] };
  const blockedFeatures = [...nav.hidden, ...nav.off];
  const blocked = access ? blockReason(pathname, access) : null;

  return (
    <html lang={locale} dir={dir}>
      <head>
        {/*
          The browser offers to install the app through `beforeinstallprompt`,
          and fires it once, early — usually before React has hydrated. If
          nothing takes it at that moment the offer is gone, and the install
          button in Settings would have nothing to open. So it is caught here,
          inline, before any component exists, and parked on `window` for the
          panel to pick up whenever the person opens Settings.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              window.__spirInstall = null;
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__spirInstall = e;
                window.dispatchEvent(new Event('spir-installable'));
              });
              window.addEventListener('appinstalled', function () {
                window.__spirInstall = null;
                window.dispatchEvent(new Event('spir-installed'));
              });
            })();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-surface-gray-1 text-ink-gray-8 antialiased">
        <LocaleProvider locale={locale}>
        <OfflineProvider>
        <ErrorReporter />
        <ServiceWorkerRegistrar />
        <Toasts />
        <NavProgress />
        {isBare || !user || isFocused ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-outline-gray-2 bg-surface-white/80 backdrop-blur-xl md:flex">
              <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold tracking-tight text-ink-gray-8">
                <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
                Spir-Margin
              </div>
              <AppNav locale={locale} hidden={nav.hidden} off={nav.off} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-outline-gray-2 bg-surface-white/85 px-4 shadow-sm backdrop-blur-xl md:px-6">
                <div className="flex items-center gap-3">
                  <MobileSidebar>
                    <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold tracking-tight text-ink-gray-8">
                      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
                      Spir-Margin
                    </div>
                    <AppNav locale={locale} hidden={nav.hidden} off={nav.off} />
                  </MobileSidebar>
                  <NewButton locale={locale} blocked={blockedFeatures} />
                  <div className="hidden min-w-0 sm:block">
                    <Awesomebar locale={locale} blocked={blockedFeatures} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-2 sm:flex">
                    <SyncStatus />
                    <DbSyncStatus />
                  </div>
                  <NotificationBell items={notifications} locale={locale} />
                  <UserMenu user={user} locale={locale} />
                </div>
              </header>
              <main className="flex-1 p-6">
                {blocked ? <FeatureUnavailable reason={blocked} /> : children}
              </main>
            </div>
          </div>
        )}
        </OfflineProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
