import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dumpLocalDatabase } from "@/lib/db/pglite";

export const dynamic = "force-dynamic";

/**
 * Download a complete copy of this machine's database.
 *
 * A backup is every record the company has, so it is admin-only. It is a
 * route rather than a Server Action because the file goes straight to the
 * browser as a download; actions return values, not attachments.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const dump = await dumpLocalDatabase();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return new NextResponse(dump.stream(), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="spir-margin-${stamp}.tar.gz"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[backup] dump failed:", e);
    return new NextResponse("Backup failed", { status: 500 });
  }
}
