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
  role: "admin" | "manager" | "staff";
}

function secretKey(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "spir-margin-dev-insecure-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, full_name: user.full_name, role: user.role })
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
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
