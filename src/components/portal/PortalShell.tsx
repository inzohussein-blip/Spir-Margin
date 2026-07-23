import Link from "next/link";
import { LogOutIcon, MonitorIcon, LifeBuoyIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

/** Minimal, self-contained chrome for the customer portal (no staff desk). */
export function PortalShell({
  labName,
  active,
  children,
}: {
  labName: string;
  active: "devices" | "tickets";
  children: React.ReactNode;
}) {
  const locale = getLocale();
  const tab = (href: string, key: string, Icon: typeof MonitorIcon, on: boolean) => (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
        on ? "bg-brand text-white" : "text-ink-gray-6 hover:bg-surface-gray-2"
      }`}
    >
      <Icon size={15} /> {t(locale, key)}
    </Link>
  );

  return (
    <div className="min-h-screen bg-surface-gray-1">
      <header className="flex h-14 items-center justify-between border-b border-outline-gray-2 bg-surface-white px-4 sm:px-6">
        <div className="flex items-center gap-2 text-lg font-semibold text-ink-gray-8">
          <span className="grid size-7 place-items-center rounded-md bg-brand text-white">S</span>
          {t(locale, "Customer Portal")}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink-gray-5 sm:inline">{labName}</span>
          <form action={logoutAction}>
            <button className="flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm text-ink-gray-6 hover:bg-surface-gray-2">
              <LogOutIcon size={15} /> {t(locale, "Sign out")}
            </button>
          </form>
        </div>
      </header>
      <nav className="flex gap-2 border-b border-outline-gray-1 bg-surface-white px-4 py-2 sm:px-6">
        {tab("/portal", "My devices", MonitorIcon, active === "devices")}
        {tab("/portal/tickets", "Support tickets", LifeBuoyIcon, active === "tickets")}
      </nav>
      <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
