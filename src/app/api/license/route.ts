import { NextResponse } from "next/server";
import { codesServerEnabled, getContact } from "@/lib/license/server";

/**
 * Is this server handing out activation codes, and the contact line the
 * activation and lock screens show. Computers ask this before anything else.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = codesServerEnabled();
  const contact = enabled ? await getContact().catch(() => "") : "";
  return NextResponse.json({ enabled, contact }, { headers: { "cache-control": "no-store" } });
}
