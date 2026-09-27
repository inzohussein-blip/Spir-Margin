import { NextResponse, type NextRequest } from "next/server";
import { codesDb, codesServerEnabled } from "@/lib/license/server";
import { normalizeCode } from "@/lib/license/core";
import { ipOf } from "@/lib/license/owner";
import { deviceReply } from "../reply";

/** A company enters its code on a computer (the first one starts the period; more take seats). */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!codesServerEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });
  const { licenses } = await codesDb();
  const ip = ipOf(req.headers);
  if (await licenses.blocked("activate", ip, 10)) return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });
  let code = "", device = "", label = "", version = "", browser = false;
  try {
    const b = await req.json();
    code = String(b?.code ?? ""); device = String(b?.device ?? ""); label = String(b?.label ?? ""); version = String(b?.version ?? "");
    browser = b?.kind === "browser";
  } catch { /* empty */ }
  if (normalizeCode(code).length < 8 || !/^[\w-]{8,80}$/.test(device)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const r = await licenses.activate(code, device, label, version);
  if (!r.ok && r.error === "not_found") {
    await licenses.noteAttempt("activate", ip);
    await new Promise((res) => setTimeout(res, 400)); // slows guessing down
  } else {
    await licenses.clearAttempts("activate", ip);
  }
  return deviceReply(r, { browser });
}
