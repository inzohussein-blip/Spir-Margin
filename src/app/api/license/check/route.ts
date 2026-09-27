import { NextResponse, type NextRequest } from "next/server";
import { codesDb, codesServerEnabled } from "@/lib/license/server";
import { cleanSyncReport, type SyncReport } from "@/lib/license/core";
import { deviceReply } from "../reply";

/**
 * A computer's periodic check: its license signed again with the current
 * period, stations and message — or the reason it no longer runs. It may also
 * say which database it linked on its own (the host only), and how its sync
 * stands (last sync, changes waiting, last error), for the owner's list.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!codesServerEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });
  let lid = "", device = "", version = "", syncHost: string | null = null, report: SyncReport | null = null, browser = false;
  try {
    const b = await req.json();
    lid = String(b?.lid ?? ""); device = String(b?.device ?? ""); version = String(b?.version ?? "");
    if (typeof b?.syncHost === "string") syncHost = b.syncHost.slice(0, 200);
    report = cleanSyncReport(b?.sync);
    browser = b?.kind === "browser";
  } catch { /* empty */ }
  if (!lid || !device) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const { licenses } = await codesDb();
  const r = await licenses.check(lid, device, version, report);
  if (r.ok && syncHost != null && !r.sync) await licenses.noteDeviceSync(lid, syncHost);
  return deviceReply(r, { browser });
}
