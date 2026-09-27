"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { saveQuizResult } from "@/app/actions/guides";
import type { Question } from "@/lib/guides/core";

/** The quiz: one question at a time, then the score, saved with the trainee. */
export function QuizRunner({ questions, trainees, category }: {
  questions: Question[];
  trainees: { id: string; full_name: string }[];
  category: string | null;
}) {
  const locale = useLocale();
  const [trainee, setTrainee] = useState("");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState("");
  const [pending, start] = useTransition();
  const q = questions[i];
  const right = questions.filter((x, n) => answers[n] === x.answer).length;

  const finish = () => {
    setDone(true);
    if (!trainee) return;
    start(async () => {
      const res = await saveQuizResult({
        trainee, category, score: right, total: questions.length,
        details: questions.map((x, n) => ({ q: x.prompt, subject: x.subject, chosen: answers[n] >= 0 ? x.options[answers[n]] : null, right: x.options[x.answer], ok: answers[n] === x.answer })),
      });
      setSaved(res?.error ? t(locale, res.error) : t(locale, "Saved with the trainee's results."));
    });
  };

  if (!questions.length) return <p className="text-sm text-ink-gray-6">{t(locale, "Not enough guides yet to make questions. Write a few guides with steps, a purpose and troubleshooting.")}</p>;

  if (done) {
    const pct = Math.round((right / questions.length) * 100);
    return (
      <div className="space-y-4" data-testid="quiz-result">
        <div className={`rounded-2xl p-5 text-center ${pct >= 70 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          <div className="text-3xl font-bold tabular-nums" data-score={`${right}/${questions.length}`}>{right} / {questions.length}</div>
          <div className="text-sm">{pct}%</div>
          {pending ? <div className="mt-1 text-xs">…</div> : saved ? <div className="mt-1 text-xs">{saved}</div> : null}
        </div>
        <ol className="space-y-2 text-sm">
          {questions.map((x, n) => (
            <li key={x.id} className="rounded-lg border border-outline-gray-2 p-3">
              <div className="text-xs text-ink-gray-5">{t(locale, x.prompt)}</div>
              <div className="font-medium">{x.subject}</div>
              <div className={`mt-1 flex items-center gap-1 ${answers[n] === x.answer ? "text-emerald-700" : "text-red-700"}`}>
                {answers[n] === x.answer ? <CheckIcon size={14} /> : <XIcon size={14} />} {x.options[x.answer]}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="quiz">
      {i === 0 && (
        <label className="block text-sm">{t(locale, "Trainee")}
          <select value={trainee} onChange={(e) => setTrainee(e.target.value)} name="trainee" className="ms-2 rounded-md border border-outline-gray-2 px-2 py-1">
            <option value="">{t(locale, "— practice, not saved —")}</option>
            {trainees.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
          </select>
        </label>
      )}
      <div className="text-xs text-ink-gray-5 tabular-nums">{i + 1} / {questions.length}</div>
      <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5">
        <div className="text-sm text-ink-gray-5">{t(locale, q.prompt)}</div>
        <div className="mt-1 text-lg font-semibold" dir="auto">{q.subject}</div>
        <div className="mt-4 grid gap-2">
          {q.options.map((o, n) => (
            <button key={n} type="button" onClick={() => setAnswers((a) => a.map((v, k) => (k === i ? n : v)))}
              className={`rounded-lg border px-3 py-2 text-start text-sm ${answers[i] === n ? "border-indigo-500 bg-indigo-50" : "border-outline-gray-2 hover:bg-surface-gray-1"}`} data-option={n}>
              {o}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-lg border border-outline-gray-2 px-4 py-2 text-sm disabled:opacity-40">{t(locale, "Previous")}</button>
        {i < questions.length - 1
          ? <button type="button" onClick={() => setI(i + 1)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{t(locale, "Next")}</button>
          : <button type="button" onClick={finish} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" data-testid="finish">{t(locale, "Finish")}</button>}
      </div>
    </div>
  );
}
