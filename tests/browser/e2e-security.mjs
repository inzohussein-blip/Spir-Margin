// Launch-blocking security properties, checked against the real server.
//
// Sessions are signed JWTs. Until the launch audit, an install with no
// AUTH_SECRET signed them with a key written in the app's own source — public
// and identical everywhere — so anyone who could reach the port could mint an
// admin session. These checks keep that from coming back.
import { jwtVerify, SignJWT } from "jose";
import { H, ACCOUNT, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("security");
const OLD_PUBLIC_KEY = new TextEncoder().encode("spir-margin-dev-insecure-secret-change-me");

// 1. A session minted with the old public key must be worthless.
const forged = await new SignJWT({ email: ACCOUNT.email, role: "admin", full_name: "x", lab_id: null })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject("00000000-0000-0000-0000-000000000001")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(OLD_PUBLIC_KEY);
const res = await fetch(H + "/labs", { headers: { cookie: `spir_session=${forged}` }, redirect: "manual" });
check("a session forged with the old public key is refused",
  res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/login"),
  `${res.status} ${res.headers.get("location") ?? ""}`);

// 2. A real session must not be verifiable with that key — i.e. this install
//    signs with a secret of its own.
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG" });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const cookie = (await ctx.cookies()).find((c) => c.name === "spir_session");
check("signing in issues a session", !!cookie);
let verifiesWithOldKey = false;
try {
  await jwtVerify(cookie?.value ?? "", OLD_PUBLIC_KEY);
  verifiesWithOldKey = true;
} catch {
  /* expected */
}
check("the session is signed with this install's own secret", !!cookie && !verifiesWithOldKey);
check("the session cookie is not readable by page scripts", cookie?.httpOnly === true);
check("the session cookie is not sent cross-site", cookie?.sameSite === "Lax" || cookie?.sameSite === "Strict",
  String(cookie?.sameSite));

// 3. Defence-in-depth headers on an ordinary page.
const page = await p.request.get(H + "/labs");
const h = page.headers();
check("pages refuse to be framed", h["x-frame-options"] === "DENY", h["x-frame-options"]);
check("content types are not sniffed", h["x-content-type-options"] === "nosniff");
check("the referrer stays on this site", h["referrer-policy"] === "same-origin", h["referrer-policy"]);

// 4. Signed out, business pages and data are out of reach.
const anon = await fetch(H + "/sales-orders", { redirect: "manual" });
check("a signed-out visitor is sent to sign in", anon.status >= 300 && anon.status < 400, String(anon.status));
const backup = await fetch(H + "/api/backup", { redirect: "manual" });
check("a signed-out visitor cannot download a backup",
  backup.status !== 200, String(backup.status));

await browser.close();
done();
