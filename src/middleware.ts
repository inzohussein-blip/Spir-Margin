import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { PLATFORM_MODE_COOKIE } from "@/lib/auth/platform-mode";

// Paths reachable without a session. The PWA manifest must be fetchable by the
// browser before login so the app is installable (add to home screen). The
// `/welcome` picker gates first-time visitors before they even see `/login`.
const PUBLIC_PATHS = ["/login", "/welcome", "/manifest.webmanifest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const hasMode = !!req.cookies.get(PLATFORM_MODE_COOKIE)?.value;

  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  // Signed-in users have no reason to see the picker or the login page.
  if (user && (pathname === "/login" || pathname === "/welcome")) {
    return NextResponse.redirect(new URL(user.role === "customer" ? "/portal" : "/", req.url));
  }

  // First-time visitors pick their platform before signing in.
  if (!user && !hasMode && pathname !== "/welcome" && !pathname.startsWith("/welcome/") && pathname !== "/manifest.webmanifest") {
    return NextResponse.redirect(new URL("/welcome", req.url));
  }

  // Everything else requires a session.
  if (!user && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role gating: portal (customer) users live only under /portal; staff never
  // see the portal. This is a hard boundary enforced before any page renders.
  if (user) {
    if (user.role === "customer" && !isPortal && !isPublic) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    if (user.role !== "customer" && isPortal) {
      return NextResponse.redirect(new URL("/", req.url));
    }
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
