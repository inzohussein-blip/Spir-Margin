import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Category, Guide, Step, Trouble } from "@/lib/guides/core";

export const GUIDE_PAGES: [string, string][] = [
  ["/guides", "Guides"],
  ["/guides/quiz", "Quiz"],
  ["/guides/trainees", "Trainees"],
];

export function GuideTabs({ active }: { active: string }) {
  const locale = getLocale();
  return (
    <nav className="no-print -mx-1 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={t(locale, "Guides & training")}>
      {GUIDE_PAGES.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${href === active ? "bg-indigo-600 text-white" : "text-ink-gray-6 hover:bg-surface-gray-2"}`}>
          {t(locale, label)}
        </Link>
      ))}
    </nav>
  );
}

export const CATEGORY_LABEL: Record<Category, string> = {
  device: "Device", kit: "Kit", procedure: "Procedure", safety: "Safety", other: "Other",
};

export interface GuideRow extends Guide {
  summary: string | null; safety: string | null; product_id: string | null; version: number;
  reviewed_by: string | null; reviewed_at: string | null; next_review: string | null; updated_at: string;
  products?: { name: string; item_code: string } | null;
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : typeof v === "string" ? (() => { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } })() : []);

export function toGuide(r: Record<string, unknown>): GuideRow {
  return {
    ...(r as unknown as GuideRow),
    steps: arr<Step>(r.steps),
    tips: arr<string>(r.tips),
    troubles: arr<Trouble>(r.troubles),
    version: Number(r.version) || 1,
  };
}

export async function guides(): Promise<GuideRow[]> {
  const { data } = await createClient().from("kb_guides")
    .select("id, title, category, product_id, purpose, summary, steps, tips, safety, troubles, version, reviewed_by, reviewed_at, next_review, updated_at, products(name, item_code)")
    .order("title");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toGuide);
}
