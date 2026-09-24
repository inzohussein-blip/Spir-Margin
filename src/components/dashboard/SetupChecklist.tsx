import Link from "next/link";
import { CheckCircle2Icon, CircleIcon, RocketIcon } from "lucide-react";
import type { SetupStep } from "@/lib/setup-checklist";
import { t, type Locale } from "@/lib/i18n";

const LABEL: Record<SetupStep["key"], string> = {
  company: "Enter the company's name and logo",
  password: "Change the built-in account's password (123)",
  accounts: "Make an account for each person who will use the program",
  copy: "Keep a second copy outside this computer: another office computer linked to it, or automatic backups to another drive",
};

/** The first steps of a new company, until they are all done. */
export function SetupChecklist({ steps, locale }: { steps: SetupStep[]; locale: Locale }) {
  const left = steps.filter((s) => !s.done).length;
  if (!left) return null;
  return (
    <section data-testid="setup-checklist" className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-gray-8">
        <RocketIcon size={17} className="text-brand" /> {t(locale, "Getting started")}
      </h2>
      <p className="mt-1 text-sm text-ink-gray-6">
        {t(locale, "This program is your company's own: its records, accounts and codes stay on this computer. A few steps make it ready for real work.")}
      </p>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? <CheckCircle2Icon size={16} className="text-emerald-600" /> : <CircleIcon size={16} className="text-ink-gray-4" />}
            {s.done ? (
              <span className="text-ink-gray-5 line-through">{t(locale, LABEL[s.key])}</span>
            ) : (
              <Link href={s.href} className="font-medium text-brand hover:underline">{t(locale, LABEL[s.key])}</Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
