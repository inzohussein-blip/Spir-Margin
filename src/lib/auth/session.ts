import { SignJWT, jwtVerify } from "jose";
import { LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_ID } from "@/lib/auth/local-credentials";

/**
 * Signed-cookie sessions for the app's built-in auth. Uses `jose` (Web Crypto),
 * so the same helpers verify in both the Edge middleware and Node server code.
 *
 * The signing secret comes from AUTH_SECRET; if unset it falls back to the
 * Supabase service-role key (already a high-entropy server secret) so no extra
 * env var is strictly required. Set AUTH_SECRET in production for clarity.
 *
 * `verifySessionToken` is a pure token check. The "local platform needs no
 * sign-in" rule depends on the platform-mode cookie as well as the build flag,
 * so it lives in the callers that can see cookies — `middleware.ts` and
 * `getCurrentUser()` — which both fall back to LOCAL_TRIAL_USER.
 */

export const SESSION_COOKIE = "spir_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "manager" | "staff" | "customer";
  /** Set only for portal (customer) users — the lab they may see. */
  lab_id: string | null;
}

/** The implicit "you are signed in" user on the local platform (no sign-in). */
export const LOCAL_TRIAL_USER: SessionUser = {
  id: LOCAL_ADMIN_ID,
  email: LOCAL_ADMIN_EMAIL,
  full_name: "المسؤول (نسخة تجريبية)",
  role: "admin",
  lab_id: null,
};

let warnedNoSecret = false;

function secretKey(): Uint8Array {
  // The first env var that is set becomes the JWT signing key. AUTH_SECRET is
  // the intended production value, but the app also accepts high-entropy
  // secrets that any hosted deployment already has to configure — the
  // Supabase service-role or anon key, and the Postgres connection string
  // (which carries the DB password). This avoids a hard 500 on a Vercel
  // deployment where the operator forgot to set AUTH_SECRET but has a
  // hosted DB configured, while still failing fast on a truly bare
  // deployment where nothing shared-secret exists.
  const configured =
    process.env.AUTH_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.DATABASE_URL;
  if (configured) {
    if (
      process.env.NODE_ENV === "production"
      && !process.env.AUTH_SECRET
      && !process.env.SUPABASE_SERVICE_ROLE_KEY
      && !warnedNoSecret
    ) {
      warnedNoSecret = true;
      console.warn(
        "[auth] AUTH_SECRET is not set — using DATABASE_URL / anon key as the signing secret. Set AUTH_SECRET for clarity.",
      );
    }
    return new TextEncoder().encode(configured);
  }

  // Nothing at all is configured. Signing with a public, hardcoded key means
  // anyone can forge a session — unacceptable on a real hosted deployment,
  // so fail fast. The zero-config embedded local build still runs (with a
  // loud one-time warning).
  const looksDeployed = !!(
    process.env.VERCEL || process.env.RENDER || process.env.FLY_APP_NAME
  );
  if (process.env.NODE_ENV === "production" && looksDeployed) {
    throw new Error(
      "AUTH_SECRET is not set. Set AUTH_SECRET (or SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL) to a strong random value before deploying.",
    );
  }
  if (process.env.NODE_ENV === "production" && !warnedNoSecret) {
    warnedNoSecret = true;
    console.warn(
      "[auth] AUTH_SECRET is not set — using an INSECURE built-in signing key. Set AUTH_SECRET before exposing this app publicly.",
    );
  }
  return new TextEncoder().encode("spir-margin-dev-insecure-secret-change-me");
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, full_name: user.full_name, role: user.role, lab_id: user.lab_id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.sub),
      email: String(payload.email),
      full_name: (payload.full_name as string | null) ?? null,
      role: (payload.role as SessionUser["role"]) ?? "staff",
      lab_id: (payload.lab_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
