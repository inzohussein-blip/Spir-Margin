import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { currentBuild, readUpdateStatus, updateRunning } from "@/lib/update/updates";

export const dynamic = "force-dynamic";

/** Progress of an update, for Settings to follow while the program restarts. Admin only. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const s = readUpdateStatus();
  return NextResponse.json(
    { state: s?.state ?? null, number: s?.number ?? 0, running: updateRunning(), current: currentBuild()?.number ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
