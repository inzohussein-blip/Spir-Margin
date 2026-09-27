import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { STATION_COOKIE, STATION_IDS } from "@/lib/license/modules";

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
  "/offline-sw.js", "/offline.html", "/licenses", "/api/license", "/verify", "/api/ping",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isWelcome = pathname === "/welcome" || pathname.startsWith("/welcome/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Signed in, the sign-in page leads on: to the page asked for, or to the
  // main menu (the welcome page, which signed-in staff use to pick a station).
  if (user && pathname === "/login") {
    const next = req.nextUrl.searchParams.get("next") ?? "";
    const safe = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.startsWith("/login") ? next : "";
    return NextResponse.redirect(new URL(user.role === "customer" ? "/portal" : safe || "/welcome", req.url));
  }
  if (user?.role === "customer" && isWelcome) return NextResponse.redirect(new URL("/portal", req.url));

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
  // Whose page this is: the offline worker keeps copies of a person's pages
  // only for that person, and drops them when nobody is signed in.
  const tag = (res: NextResponse) => { res.headers.set("x-spir-user", user ? user.id : "0"); return res; };

  if (user && user.role !== "customer") {
    // Opening the program (the desktop icon, a bookmark, the address typed)
    // starts at the main menu, not in the middle of the dashboard: a full
    // page load that no page led to (no Referer). Links inside the app are not
    // affected — they carry the page they came from, or are not page loads at
    // all (RSC). Sec-Fetch-Site would say the same, but the offline worker
    // re-sends page loads as its own, which makes it "same-origin".
    const fresh = req.method === "GET" && !req.headers.get("referer") && !req.headers.get("rsc")
      && (req.headers.get("accept") ?? "").includes("text/html");
    if (pathname === "/" && fresh) return tag(NextResponse.redirect(new URL("/welcome", req.url)));
    // «The whole system»: the dashboard, with every section in the sidebar.
    if (pathname === "/station/all") {
      headers.set("x-pathname", "/");
      const res = NextResponse.rewrite(new URL("/", req.url), { request: { headers } });
      res.cookies.delete(STATION_COOKIE);
      return tag(res);
    }
    // A station: its sections only, until the main menu or the whole system.
    const station = pathname.startsWith("/station/") ? pathname.split("/")[2] : null;
    if (station && STATION_IDS.includes(station)) {
      const res = NextResponse.next({ request: { headers } });
      // Readable by the page: the sidebar (kept across navigations) follows it.
      res.cookies.set(STATION_COOKIE, station, { path: "/", sameSite: "lax", maxAge: 30 * 86_400 });
      return tag(res);
    }
    if (pathname === "/") {
      const res = NextResponse.next({ request: { headers } });
      if (req.cookies.has(STATION_COOKIE)) res.cookies.delete(STATION_COOKIE);
      return tag(res);
    }
  }
  return tag(NextResponse.next({ request: { headers } }));
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
