import Link from "next/link";
import { CopyPlusIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

/** "Copy": a new document starting as this one (src/lib/copy-docs.ts). */
export function CopyLink({ href, size = "sm" }: { href: string; size?: "sm" | "xs" }) {
  const locale = getLocale();
  return (
    <Link
      href={href}
      title={t(locale, "A new document with the same customer and lines, dated today")}
      data-copy-link
      className={`inline-flex items-center gap-1 rounded-md border border-outline-gray-2 font-medium text-ink-gray-6 hover:border-brand hover:text-brand ${
        size === "xs" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      }`}
    >
      <CopyPlusIcon size={size === "xs" ? 12 : 14} /> {t(locale, "Copy")}
    </Link>
  );
}
