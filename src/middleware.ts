import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Paths reachable without a session.
const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Signed-in users have no reason to see the login page.
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Everything else requires a session.
  if (!user && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Expose the path to the root layout so it can skip the app shell on /login.
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
