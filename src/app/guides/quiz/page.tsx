import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { buildQuiz, CATEGORIES, type Category } from "@/lib/guides/core";
import { CATEGORY_LABEL, GuideTabs, guides } from "@/components/guides/parts";
import { QuizRunner } from "@/components/guides/QuizRunner";

export const dynamic = "force-dynamic";

/** A quiz made from the guides — for new staff and field engineers. */
export default async function QuizPage({ searchParams }: { searchParams?: { c?: string; n?: string; seed?: string } }) {
  const locale = getLocale();
  const c = CATEGORIES.includes(searchParams?.c as Category) ? (searchParams?.c as Category) : undefined;
  const n = Math.min(30, Math.max(3, Number(searchParams?.n) || 10));
  const seed = Number(searchParams?.seed) || Math.floor(Math.random() * 1e9);
  const [all, tr] = await Promise.all([guides(), createClient().from("kb_trainees").select("id, full_name").order("full_name")]);
  const questions = buildQuiz(all, n, seed, c);
  return (
    <div className="space-y-5">
      <GuideTabs active="/guides/quiz" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Quiz")}</h1>
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label>{t(locale, "Kind")}
          <select name="c" defaultValue={c ?? ""} className="ms-2 rounded-md border border-outline-gray-2 px-2 py-1">
            <option value="">{t(locale, "All")}</option>
            {CATEGORIES.map((k) => <option key={k} value={k}>{t(locale, CATEGORY_LABEL[k])}</option>)}
          </select>
        </label>
        <label>{t(locale, "Questions")}
          <input name="n" type="number" min="3" max="30" defaultValue={n} className="ms-2 w-20 rounded-md border border-outline-gray-2 px-2 py-1" dir="ltr" />
        </label>
        <button className="rounded-lg border border-outline-gray-2 px-3 py-1.5 hover:bg-surface-gray-1">{t(locale, "New quiz")}</button>
        <Link href="/guides/trainees" className="text-brand hover:underline">{t(locale, "Trainees")}</Link>
      </form>
      <div className="max-w-2xl"><QuizRunner key={`${seed}-${c}-${n}`} questions={questions} trainees={(tr.data as { id: string; full_name: string }[] | null) ?? []} category={c ?? null} /></div>
    </div>
  );
}
