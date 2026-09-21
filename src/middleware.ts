import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, LOCAL_TRIAL_USER, verifySessionToken } from "@/lib/auth/session";
import { PLATFORM_MODE_COOKIE, resolvePlatform } from "@/lib/auth/platform-mode";
import { isHybridBuild } from "@/lib/runtime/platform";

// Paths reachable without a session. The PWA manifest must be fetchable by the
// browser before login so the app is installable (add to home screen). The
// `/welcome` picker gates first-time visitors on the HYBRID build only.
// `/sw.js` no longer exists, but browsers that installed the old service
// worker still request it. Letting it 404 cleanly is what makes them drop the
// registration; redirecting it into the app would keep a dead worker alive.
const PUBLIC_PATHS = ["/login", "/welcome", "/manifest.webmanifest", "/sw.js"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isWelcome = pathname === "/welcome" || pathname.startsWith("/welcome/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  // Which platform applies: the build flag, else the visitor's picker choice.
  // null means "hybrid build, nothing picked yet" → send them to the picker.
  const platform = resolvePlatform(req.cookies.get(PLATFORM_MODE_COOKIE)?.value);

  // The local platform has no sign-in: every request is the local admin.
  const user =
    platform === "local"
      ? LOCAL_TRIAL_USER
      : await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Signed-in users have no reason to see the picker or the login page.
  if (user && (pathname === "/login" || isWelcome)) {
    return NextResponse.redirect(new URL(user.role === "customer" ? "/portal" : "/", req.url));
  }

  // A specialised build is a single platform, so the picker has nothing to
  // offer — reroute it to sign-in.
  if (!isHybridBuild && isWelcome) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Hybrid build, no choice made yet: pick a platform first.
  if (platform === null && !isWelcome && !isPublic) {
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
