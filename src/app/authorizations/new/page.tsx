import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationForm } from "@/components/shortcuts/AuthorizationForm";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewAuthorizationPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("devices")
    .select("id, asset_code, serial_no, products(name)")
    .order("asset_code")
    .limit(500);

  const devices = (
    (data as unknown as { id: string; asset_code: string; serial_no: string | null; products: { name: string } | null }[]) ?? []
  ).map((d) => ({
    id: d.id,
    label: `${d.products?.name ?? d.asset_code} (${d.asset_code})`,
    serial: d.serial_no,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-gray-5">
        <Link href="/authorizations" className="hover:text-brand">
          <span aria-hidden>→</span> {t(locale, "Transport authorisations")}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New transport authorisation")}</h1>
        <p className="text-sm text-ink-gray-5">
          {t(locale, "A letter authorising equipment to be moved between governorates, to be carried and shown on the way.")}
        </p>
      </div>
      <AuthorizationForm devices={devices} />
    </div>
  );
}
