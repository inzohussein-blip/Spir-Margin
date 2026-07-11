import Link from "next/link";
import { TaxTemplateForm } from "@/components/accounts/TaxTemplateForm";

export default function NewTaxTemplatePage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/taxes" className="hover:text-brand">← Taxes</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Tax Template</h1>
      <TaxTemplateForm />
    </div>
  );
}
