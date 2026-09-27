import { NextResponse } from "next/server";
import { codesDb, codesServerEnabled, getContact } from "@/lib/license/server";

/**
 * Is this server handing out activation codes, the contact line the
 * activation and lock screens show, and what the owner has switched on for
 * the web app (self-registration, the error log, when "ending soon" starts).
 * Computers and browsers ask this before anything else.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = codesServerEnabled();
  if (!enabled) return NextResponse.json({ enabled, contact: "" }, { headers: { "cache-control": "no-store" } });
  const [contact, prefs] = await Promise.all([
    getContact().catch(() => ""),
    codesDb().then(({ licenses }) => licenses.prefs()).catch(() => null),
  ]);
  return NextResponse.json(
    { enabled, contact, signup: !!prefs?.selfSignup, errorLog: !!prefs?.errorLog, warnDays: prefs?.warnDays ?? 14 },
    { headers: { "cache-control": "no-store" } },
  );
}
