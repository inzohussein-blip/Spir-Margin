import { LoginForm } from "@/components/auth/LoginForm";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const locale = getLocale();
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-outline-gray-2 bg-surface-white p-8 shadow-md">
        <div className="mb-6 flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-gray-8">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
          Spir-Margin
        </div>
        <h1 className="text-xl font-bold text-ink-gray-9">{t(locale, "Sign in")}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">{t(locale, "Medical-device sales, lab tracking & banking.")}</p>
        <LoginForm />
      </div>
    </div>
  );
}
