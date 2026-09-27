import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Paths reachable without a session. The PWA manifest must be fetchable by the
// browser before login so the app is installable (add to home screen).
// `/welcome` is the public landing screen. `/sw.js` no longer exists, but
// browsers that installed the old service worker still request it — letting it
// 404 cleanly is what makes them drop the registration; redirecting it into the
// app would keep a dead worker alive. `/offline-sw.js` and the page it shows
// when the program is not running must load for anyone, signed in or not.
// `/licenses` and `/api/license` are the codes server: the owner's page has a
// sign-in of its own (LICENSE_ADMIN_PASSWORD), and computers activating a code
// have no account there.
const PUBLIC_PATHS = [
  "/login", "/welcome", "/manifest.webmanifest", "/sw.js",
  "/offline-sw.js", "/offline.html", "/licenses", "/api/license", "/verify",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isWelcome = pathname === "/welcome" || pathname.startsWith("/welcome/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Signed-in users have no reason to see the landing screen or the login page —
  // unless it is to enter or renew this computer's activation code there.
  const forLicense = isWelcome && (req.nextUrl.searchParams.has("activate") || req.nextUrl.searchParams.has("license"));
  if (user && (pathname === "/login" || (isWelcome && !forLicense))) {
    return NextResponse.redirect(new URL(user.role === "customer" ? "/portal" : "/", req.url));
  }

  // Everything else requires a session. A person opening a page is shown the
  // welcome screen first (the stations, then sign-in); anything else — an API
  // call, a form post — goes straight to sign-in as before.
  if (!user && !isPublic) {
    const page = (req.method === "GET" || req.method === "HEAD") && !pathname.startsWith("/api/");
    const url = new URL(page ? "/welcome" : "/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search);
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
