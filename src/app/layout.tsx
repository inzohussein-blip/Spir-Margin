import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
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
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { ErrorReporter } from "@/components/monitoring/ErrorReporter";
import { Toasts } from "@/components/desk/Toasts";
import { FeatureUnavailable } from "@/components/settings/FeatureUnavailable";
import { readSession } from "@/lib/auth/current-user";
import { deviceState, deviceInfo } from "@/lib/license/device";
import { isLocked, daysLeft, WARN_DAYS, type DeviceState } from "@/lib/license/state";
import { getNotifications } from "@/lib/notifications";
import { updateAvailable } from "@/lib/update/updates";
import { currentCopyState } from "@/lib/backup/copies-server";
import { getAccessContext, blockReason, navFeatureState } from "@/lib/features";
import { getLocale } from "@/lib/i18n-server";
import { STATION_COOKIE, stationById } from "@/lib/license/modules";
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
    pathname === "/licenses" ||
    pathname.startsWith("/licenses/") ||
    pathname.startsWith("/verify/") ||
    pathname.startsWith("/welcome/");
  // Focused pages keep auth but provide their own chrome (POS terminal, and the
  // customer portal, which must never show the staff desk shell).
  const isFocused =
    pathname === "/pos" || pathname.startsWith("/pos/") ||
    pathname === "/portal" || pathname.startsWith("/portal/");
  // This computer's activation code (src/lib/license): waiting for it, or
  // locked, every page but the welcome screen (where the code is entered)
  // and the codes server's own page sends there.
  const licenseFree = pathname === "/welcome" || pathname.startsWith("/welcome/") || pathname === "/licenses" || pathname.startsWith("/licenses/") || pathname.startsWith("/verify/") || pathname.startsWith("/login/expired");
  const license = await deviceState().catch(() => ({ kind: "off" }) as DeviceState);
  if (!licenseFree && isLocked(license)) redirect("/welcome?activate=1");
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
  // The activation code: ending soon, the grace period of a computer that
  // predates codes, and the provider's message — for everyone signed in.
  if (user && !isFocused && (license.kind === "ok" || license.kind === "grace")) {
    const left = daysLeft(license, Date.now()) ?? 0;
    if (license.kind === "grace") {
      notifications.unshift({
        title: t(locale, "Enter your company's activation code"),
        sub: `${t(locale, "This computer runs without a code until")} ${new Date(license.until).toLocaleDateString("en-CA")} (${left} ${t(locale, "days")})`,
        href: "/welcome?activate=1",
        severity: "amber",
      });
    } else if (left <= WARN_DAYS) {
      notifications.unshift({
        title: `${t(locale, "The activation code ends in")} ${left} ${t(locale, "days")}`,
        sub: `${license.company} — ${new Date(license.until).toLocaleDateString("en-CA")}`,
        href: "/welcome?license=1",
        severity: "amber",
      });
    }
    // A code with an offline limit: warn a few days before this computer must reach the server.
    if (license.kind === "ok" && license.checkBy && license.checkBy - Date.now() <= 3 * 86_400_000) {
      notifications.unshift({
        title: t(locale, "Connect this computer to the internet"),
        sub: `${t(locale, "The activation code must be checked by")} ${new Date(license.checkBy).toLocaleDateString("en-CA")}`,
        href: "/welcome?license=1",
        severity: "amber",
      });
    }
    const { message } = await deviceInfo().catch(() => ({ message: "" }));
    if (message) notifications.unshift({ title: t(locale, "Message from the provider"), sub: message, href: "/welcome?license=1", severity: "blue" });
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
  // The station gone in through, if any (not on the dashboard, which is the whole system).
  const st = showShell && pathname !== "/"
    ? stationById(/^\/station\/([a-z]+)/.exec(pathname)?.[1] ?? cookies().get(STATION_COOKIE)?.value)
    : null;
  const station = st ? { id: st.id, label: st.label, groups: st.groups } : null;

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
        <OfflineBanner />
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
              <AppNav locale={locale} hidden={nav.hidden} off={nav.off} station={station} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-outline-gray-2 bg-surface-white/85 px-4 shadow-sm backdrop-blur-xl md:px-6">
                <div className="flex items-center gap-3">
                  <MobileSidebar>
                    <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold tracking-tight text-ink-gray-8">
                      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
                      Spir-Margin
                    </div>
                    <AppNav locale={locale} hidden={nav.hidden} off={nav.off} station={station} />
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
