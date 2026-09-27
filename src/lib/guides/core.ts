/**
 * Guides & training — pure (no imports): reading the guide form, and the
 * quizzes generated from the guides (ported from spir-lab-manager's
 * training station). A question needs one right answer and three distinct
 * wrong ones drawn from the other guides; one that cannot find them is left
 * out rather than made too easy.
 */

export type Category = "device" | "kit" | "procedure" | "safety" | "other";
export const CATEGORIES: Category[] = ["device", "kit", "procedure", "safety", "other"];
export interface Step { text: string; warn: boolean }
export interface Trouble { problem: string; cause: string; fix: string }
export interface Guide {
  id: string; title: string; category: Category; purpose: string | null;
  steps: Step[]; tips: string[]; troubles: Trouble[];
}

/** One step per line; a line starting with "!" is a warning. */
export function parseSteps(text: string): Step[] {
  return String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 80)
    .map((l) => (l.startsWith("!") ? { text: l.slice(1).trim(), warn: true } : { text: l, warn: false }))
    .filter((s) => s.text);
}
export const stepsText = (s: Step[]) => s.map((x) => (x.warn ? `! ${x.text}` : x.text)).join("\n");

export const parseLines = (text: string) => String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 40);

/** "problem | cause | fix", one per line. */
export function parseTroubles(text: string): Trouble[] {
  return parseLines(text).map((l) => {
    const [problem = "", cause = "", fix = ""] = l.split("|").map((x) => x.trim());
    return { problem, cause, fix };
  }).filter((t) => t.problem && t.fix);
}
export const troublesText = (t: Trouble[]) => t.map((x) => `${x.problem} | ${x.cause} | ${x.fix}`).join("\n");

// ── Quizzes ──────────────────────────────────────────────────────────────────
export interface Question {
  id: string;
  kind: "purpose" | "next-step" | "which-guide" | "fix";
  prompt: string;
  /** What the question is about (a guide title, a step, a problem). */
  subject: string;
  options: string[];
  answer: number;
  guideId: string;
}

/** A small seeded generator, so a quiz can be rebuilt from its seed. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function shuffle<T>(a: T[], r: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
const norm = (s: string) => s.trim().toLowerCase();

function mcq(kind: Question["kind"], g: Guide, prompt: string, subject: string, correct: string, pool: string[], r: () => number): Question | null {
  const seen = new Set([norm(correct)]);
  const wrong: string[] = [];
  for (const w of shuffle(pool, r)) {
    if (!w.trim() || seen.has(norm(w))) continue;
    seen.add(norm(w));
    wrong.push(w);
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;
  const options = shuffle([correct, ...wrong], r);
  return { id: `${g.id}:${kind}:${norm(subject).slice(0, 40)}`, kind, prompt, subject, options, answer: options.indexOf(correct), guideId: g.id };
}

/** Up to `count` questions from `guides` (one category, if given), mixed. */
export function buildQuiz(guides: Guide[], count: number, seed: number, category?: Category): Question[] {
  const r = rng(seed);
  const pool = category ? guides.filter((g) => g.category === category) : guides;
  const purposes = guides.map((g) => g.purpose ?? "").filter(Boolean);
  const titles = guides.map((g) => g.title);
  const allSteps = guides.flatMap((g) => g.steps.map((s) => s.text));
  const fixes = guides.flatMap((g) => g.troubles.map((t) => t.fix));
  const out: Question[] = [];
  for (const g of pool) {
    if (g.purpose) {
      const q = mcq("purpose", g, "What is it for?", g.title, g.purpose, purposes.filter((p) => p !== g.purpose), r);
      if (q) out.push(q);
    }
    g.steps.forEach((s, i) => {
      const next = g.steps[i + 1];
      if (next) {
        const q = mcq("next-step", g, "Which step comes next?", `${g.title}: ${s.text}`, next.text, allSteps.filter((x) => x !== next.text && x !== s.text), r);
        if (q) out.push(q);
      }
      if (i === 0 || s.warn) {
        const q = mcq("which-guide", g, "Which guide is this step from?", s.text, g.title, titles.filter((t) => t !== g.title), r);
        if (q) out.push(q);
      }
    });
    for (const t of g.troubles) {
      const q = mcq("fix", g, "What fixes it?", `${g.title}: ${t.problem}`, t.fix, fixes.filter((f) => f !== t.fix), r);
      if (q) out.push(q);
    }
  }
  const unique = [...new Map(out.map((q) => [q.id, q])).values()];
  return shuffle(unique, r).slice(0, Math.max(1, count));
}

/** Score answers (index per question; -1 unanswered). */
export function score(questions: Question[], answers: number[]) {
  const right = questions.filter((q, i) => answers[i] === q.answer).length;
  return { right, total: questions.length, percent: questions.length ? Math.round((right / questions.length) * 100) : 0 };
}
