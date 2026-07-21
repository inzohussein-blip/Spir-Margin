import Link from "next/link";
import { getLabs, getDevices } from "@/lib/queries";
import { InstallationNoteForm } from "@/components/selling/InstallationNoteForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewInstallationNotePage() {
  const locale = getLocale();
  const [labs, devices] = await Promise.all([getLabs(), getDevices()]);
  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const deviceOpts = devices.map((d) => {
    const prod = (d as { products?: { name?: string } | null }).products;
    return {
      id: d.id as string,
      label: `${d.asset_code as string}${prod?.name ? ` · ${prod.name}` : ""}${d.serial_no ? ` (${d.serial_no})` : ""}`,
    };
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/installation-notes" className="hover:text-brand">← {t(locale, "Installation notes")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Installation Note")}</h1>
      <InstallationNoteForm labs={labOpts} devices={deviceOpts} />
    </div>
  );
}
