import { NextResponse, type NextRequest } from "next/server";
import { cloudAuth } from "@/lib/cloud/auth";
import { serveCloud, type CloudRequest } from "@/lib/cloud/serve";
import { companyDb } from "@/lib/db/pglite";

/**
 * Cloud sync for the web version's local app: one move of the sync protocol
 * (hello/pull/push/meta/snap) on the company's own database, for a browser
 * holding a valid license of that company's code. See src/lib/cloud/serve.ts.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const auth = await cloudAuth(String(b.lid ?? ""), String(b.device ?? ""), String(b.token ?? ""));
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  let db;
  try {
    db = await companyDb(auth.conn);
  } catch (e) {
    console.error("[cloud] company database unreachable:", (e as Error).message);
    return json({ error: "company_db_unreachable" }, 502);
  }
  try {
    return json(await serveCloud(db, b as unknown as CloudRequest));
  } catch (e) {
    const m = (e as Error).message;
    if (m === "bad_request") return json({ error: m }, 400);
    console.error("[cloud] sync failed:", m);
    return json({ error: "sync_failed", detail: m.slice(0, 200) }, 500);
  }
}
