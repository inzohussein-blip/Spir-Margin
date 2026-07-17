import Link from "next/link";
import { LogOutIcon, UserIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import { t, type Locale } from "@/lib/i18n";

export function UserMenu({ user, locale = "ar" }: { user: SessionUser; locale?: Locale }) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/account" className="flex items-center gap-2 text-sm text-ink-gray-7 hover:text-brand">
        <span className="grid size-7 place-items-center rounded-full bg-surface-gray-2 text-ink-gray-6">
          <UserIcon size={15} />
        </span>
        <span className="hidden sm:block">
          <span className="font-medium text-ink-gray-8">{user.full_name || user.email}</span>
          <span className="ml-1 rounded bg-surface-gray-2 px-1.5 py-0.5 text-[10px] uppercase text-ink-gray-5">{user.role}</span>
        </span>
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          title={t(locale, "Sign out")}
          className="flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1.5 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1"
        >
          <LogOutIcon size={14} /> <span className="hidden sm:inline">{t(locale, "Sign out")}</span>
        </button>
      </form>
    </div>
  );
}
