import { NextResponse, type NextRequest } from "next/server";
import { codesDb, codesServerEnabled } from "@/lib/license/server";
import { ipOf } from "@/lib/license/owner";

/**
 * An error seen in the web app, kept for the owner («سجل الأخطاء» in the code
 * manager) — only while the owner has the log on. It carries the code's id and
 * the browser's id (never the company's records), the page and the message.
 * Thirty reports per address in ten minutes at most.
 */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  if (!codesServerEnabled()) return json({ ok: false }, 400);
  const { licenses } = await codesDb();
  if (!(await licenses.prefs()).errorLog) return json({ ok: false, error: "off" });
  const ip = ipOf(req.headers);
  if (await licenses.blocked("error", ip, 30)) return json({ ok: false, error: "too_many" }, 429);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const message = String(b.message ?? "").trim();
  if (!message) return json({ ok: false, error: "bad_request" }, 400);
  await licenses.noteAttempt("error", ip);
  await licenses.recordError({
    license_id: String(b.lid ?? ""), device: String(b.device ?? ""), path: String(b.path ?? ""),
    message, agent: String(req.headers.get("user-agent") ?? ""),
  });
  return json({ ok: true });
}
