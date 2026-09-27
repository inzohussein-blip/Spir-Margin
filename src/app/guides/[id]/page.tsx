import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangleIcon, LightbulbIcon, PencilIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getBranding } from "@/lib/branding";
import { PrintButton } from "@/components/print/PrintButton";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Attachments } from "@/components/attachments/Attachments";
import { deleteGuide } from "@/app/actions/guides";
import { CATEGORY_LABEL, GuideTabs, guides } from "@/components/guides/parts";

export const dynamic = "force-dynamic";

/** A guide to read at the bench or in the field, and to print as an SOP. */
export default async function GuidePage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const g = (await guides()).find((x) => x.id === params.id);
  if (!g) notFound();
  const [brand, pics] = await Promise.all([
    getBranding(),
    createClient().from("attachments").select("id, filename, mime_type").eq("entity", "kb_guide").eq("record_id", g.id).order("created_at"),
  ]);
  const images = ((pics.data as { id: string; filename: string; mime_type: string }[] | null) ?? []).filter((a) => a.mime_type.startsWith("image/"));
  const reviewDue = g.next_review && g.next_review < localDate();

  return (
    <div className="space-y-5">
      <GuideTabs active="/guides" />
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/guides" className="text-sm text-ink-gray-5 hover:text-brand"><span aria-hidden>→</span> {t(locale, "Guides")}</Link>
        <div className="flex items-center gap-2">
          <Link href={`/guides/${g.id}/edit`} className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm hover:bg-surface-gray-1"><PencilIcon size={14} /> {t(locale, "Edit")}</Link>
          <PrintButton />
        </div>
      </div>

      <article className="rounded-2xl border border-outline-gray-2 bg-white p-6 text-ink-gray-8 print:border-0 print:p-0" data-testid="guide">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-gray-2 pb-4">
          <div>
            <div className="text-xs text-ink-gray-5">{brand.companyName || "Spir-Margin"} · {t(locale, CATEGORY_LABEL[g.category])}{g.products ? ` · ${g.products.name}` : ""}</div>
            <h1 className="mt-1 text-2xl font-bold">{g.title}</h1>
            {g.purpose && <p className="mt-1 text-sm text-ink-gray-6">{g.purpose}</p>}
          </div>
          <div className="text-end text-xs text-ink-gray-5" data-testid="doc-control">
            <div>{t(locale, "Version")} <b className="tabular-nums">{g.version}</b></div>
            {g.reviewed_by && <div>{t(locale, "Reviewed by")} {g.reviewed_by}{g.reviewed_at ? <span dir="ltr"> · {g.reviewed_at}</span> : null}</div>}
            {g.next_review && <div className={reviewDue ? "font-semibold text-amber-700" : ""}>{t(locale, "Next review")} <span dir="ltr">{g.next_review}</span></div>}
          </div>
        </header>

        {g.summary && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{g.summary}</p>}

        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={`/api/attachments/${a.id}`} alt={a.filename} className="max-h-48 w-full rounded-lg border border-outline-gray-2 object-contain" />
            ))}
          </div>
        )}

        {g.steps.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-bold">{t(locale, "Steps")}</h2>
            <ol className="space-y-2" data-testid="steps">
              {g.steps.map((s, i) => (
                <li key={i} className={`flex gap-3 rounded-lg p-2 text-sm ${s.warn ? "border border-red-200 bg-red-50 text-red-800" : ""}`} data-warn={s.warn ? "1" : undefined}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white tabular-nums">{i + 1}</span>
                  <span className="flex-1">{s.warn && <AlertTriangleIcon size={14} className="me-1 inline" />}{s.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {g.tips.length > 0 && (
          <section className="mt-6 rounded-xl bg-amber-50 p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-bold text-amber-900"><LightbulbIcon size={16} /> {t(locale, "Tips from experience")}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm text-amber-900">{g.tips.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </section>
        )}

        {g.safety && (
          <section className="mt-6 rounded-xl border border-red-200 p-4">
            <h2 className="mb-1 flex items-center gap-1.5 font-bold text-red-700"><ShieldAlertIcon size={16} /> {t(locale, "Safety")}</h2>
            <p className="whitespace-pre-line text-sm">{g.safety}</p>
          </section>
        )}

        {g.troubles.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-bold">{t(locale, "Troubleshooting")}</h2>
            <table className="w-full text-sm" data-testid="troubles">
              <thead><tr className="border-b text-xs text-ink-gray-5"><th className="py-1 text-start">{t(locale, "Problem")}</th><th className="py-1 text-start">{t(locale, "Likely cause")}</th><th className="py-1 text-start">{t(locale, "Fix")}</th></tr></thead>
              <tbody className="divide-y divide-outline-gray-1">
                {g.troubles.map((x, i) => <tr key={i}><td className="py-1.5 font-medium">{x.problem}</td><td className="py-1.5 text-ink-gray-6">{x.cause}</td><td className="py-1.5">{x.fix}</td></tr>)}
              </tbody>
            </table>
          </section>
        )}
      </article>

      <div className="no-print space-y-4">
        <Attachments entity="kb_guide" recordId={g.id} path={`/guides/${g.id}`} />
        <ValidatedForm action={deleteGuide}>
          <input type="hidden" name="id" value={g.id} />
          <button className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"><Trash2Icon size={14} /> {t(locale, "Delete this guide")}</button>
        </ValidatedForm>
      </div>
    </div>
  );
}
