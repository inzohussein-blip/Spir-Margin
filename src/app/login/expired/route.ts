import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { readSession } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/**
 * Where a session the server has ended is cleared: its cookie is still
 * correctly signed, so the middleware would keep letting it in and keep
 * sending it away from /login. Only a cookie that really has ended is
 * deleted — a link here cannot sign anyone out.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/";

  const { user, ended } = await readSession();
  if (user) return NextResponse.redirect(new URL(next, req.url));

  const url = new URL("/login", req.url);
  if (next !== "/") url.searchParams.set("next", next);
  if (ended) url.searchParams.set("ended", "1");
  const res = NextResponse.redirect(url);
  // Same path as it was set with, or the browser keeps the original.
  if (ended) res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
