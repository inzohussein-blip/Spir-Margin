import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Give every installation a session-signing secret of its own.
 *
 * Sessions are signed JWTs. Without AUTH_SECRET the app used to fall back to
 * a key written in its own source code — public, identical on every install —
 * so anyone who could reach the port could mint an admin session. Asking the
 * person installing it to invent a secret is exactly the kind of step that
 * gets skipped, so it is done here, once: a random secret is written to
 * `.env.local` (git-ignored) the first time the app is built or started, and
 * reused every time after.
 *
 * This file runs for `next build`, `next start` and `next dev` alike, so no
 * way of starting the app can skip it. Hosted deployments are left alone:
 * there the operator must set AUTH_SECRET explicitly, and session.ts refuses
 * to start without one.
 */
function ensureAuthSecret() {
  if (process.env.AUTH_SECRET) return;
  if (process.env.VERCEL || process.env.RENDER || process.env.FLY_APP_NAME) return;

  const file = path.join(process.cwd(), ".env.local");
  try {
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    const found = text.match(/^AUTH_SECRET=(.+)$/m);
    if (found) {
      process.env.AUTH_SECRET = found[1].trim();
      return;
    }
    const secret = randomBytes(48).toString("base64url");
    const sep = text && !text.endsWith("\n") ? "\n" : "";
    writeFileSync(file, `${text}${sep}AUTH_SECRET=${secret}\n`, { mode: 0o600 });
    // Env files were already read before this config ran, so set it for this
    // process too; the next start reads it from the file like any other.
    process.env.AUTH_SECRET = secret;
  } catch (e) {
    console.warn("[auth] could not create a session secret in .env.local:", e?.message ?? e);
  }
}

ensureAuthSecret();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint runs on build, and a lint error fails it.
  // PGlite ships a WASM Postgres; keep it (and its assets) out of the bundler
  // so it loads as a normal Node dependency at runtime.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite", "pg"],
  },
  // Defence-in-depth headers. The app never needs to be framed, sniffed, or to
  // tell another site which page someone came from.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
