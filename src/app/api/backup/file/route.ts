import fs from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { backupPath, folderOf, readBackupSettings } from "@/lib/backup/auto";

export const dynamic = "force-dynamic";

/** Download one of the automatic backups listed in Settings. Admin only. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const file = backupPath(folderOf(await readBackupSettings()), name);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
