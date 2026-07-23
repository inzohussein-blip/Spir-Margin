import { SignJWT, jwtVerify } from "jose";

/**
 * Signed-cookie sessions for the app's built-in auth. Uses `jose` (Web Crypto),
 * so the same helpers verify in both the Edge middleware and Node server code.
 *
 * The signing secret comes from AUTH_SECRET; if unset it falls back to the
 * Supabase service-role key (already a high-entropy server secret) so no extra
 * env var is strictly required. Set AUTH_SECRET in production for clarity.
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

let warnedNoSecret = false;

function secretKey(): Uint8Array {
  const configured = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return new TextEncoder().encode(configured);

  // No secret configured. Signing real sessions with a public, hardcoded key
  // means anyone can forge a session. On a real hosted deployment that is
  // unacceptable, so fail fast. The zero-config embedded demo (no hosted DB /
  // platform) still runs, but with a loud one-time warning.
  const looksDeployed = !!(
    process.env.DATABASE_URL || process.env.VERCEL || process.env.RENDER || process.env.FLY_APP_NAME
  );
  if (process.env.NODE_ENV === "production" && looksDeployed) {
    throw new Error(
      "AUTH_SECRET is not set. Set AUTH_SECRET (or SUPABASE_SERVICE_ROLE_KEY) to a strong random value before deploying.",
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
