"use client";

import { MessageCircleIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * Opens WhatsApp with the document's summary ready to send. The PDF itself
 * is saved from the print button and attached in the chat — WhatsApp does
 * not take files from a link.
 */
export function WhatsAppButton({ href }: { href: string }) {
  const locale = useLocale();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-whatsapp
      title={t(locale, "Opens WhatsApp with the document's summary. Save the PDF from Print and attach it in the chat.")}
      className="no-print inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
    >
      <MessageCircleIcon size={15} /> {t(locale, "WhatsApp")}
    </a>
  );
}
