import { NextResponse, type NextRequest } from "next/server";
import { codesDb, codesServerEnabled } from "@/lib/license/server";
import { cleanPhone } from "@/lib/license/core";
import { ipOf } from "@/lib/license/owner";

/**
 * Self-registration («جرّب مجاناً»): a company registers on the web app and
 * gets a trial code at once — only while the owner has it on (the code
 * manager → General settings). The trial takes the owner's trial days, the
 * stations and computers chosen there, and shows in the owner's list as a
 * trial with «تسجيل ذاتي» in its note. A few registrations per address in ten
 * minutes.
 */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  if (!codesServerEnabled()) return json({ ok: false, error: "disabled" }, 400);
  const { licenses } = await codesDb();
  const prefs = await licenses.prefs();
  if (!prefs.selfSignup) return json({ ok: false, error: "closed" }, 403);
  const ip = ipOf(req.headers);
  if (await licenses.blocked("signup", ip, 3)) return json({ ok: false, error: "too_many" }, 429);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const company = String(b.company ?? "").trim().slice(0, 120);
  const phone = cleanPhone(b.phone);
  const city = String(b.city ?? "").trim().slice(0, 60);
  if (company.length < 2 || phone.replace(/\D/g, "").length < 7) return json({ ok: false, error: "bad_request" }, 400);
  await licenses.noteAttempt("signup", ip);
  const plan = await licenses.plan();
  const { row, code } = await licenses.create({
    company, days: plan.trialDays, seats: prefs.signupSeats, modules: prefs.signupModules, trial: true, phone,
    note: ["تسجيل ذاتي", city].filter(Boolean).join(" — "),
  });
  await licenses.log(row.id, "signup", ip.slice(0, 64));
  return json({ ok: true, code, days: row.duration_days, company: row.company });
}
