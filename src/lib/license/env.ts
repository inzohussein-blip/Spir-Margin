/**
 * Where the codes server keeps its codes, and whether it is switched on.
 * Read from the environment only (edge-safe: the middleware may import it).
 *
 * The codes server is the web version on Vercel. Its codes live in a database
 * of their own — Vercel → Storage → Neon with the prefix LICENSE (it creates
 * LICENSE_DATABASE_URL / LICENSE_URL), never the company data. Run locally,
 * without one, they use the embedded database (tests, a trial).
 */
export function licenseDbUrl(): string {
  for (const k of ["LICENSE_DATABASE_URL", "LICENSE_URL", "LICENSE_POSTGRES_URL"]) {
    const v = (process.env[k] ?? "").trim();
    if (/^postgres(ql)?:\/\//.test(v)) return v;
  }
  // Other names the integration may create: prefer the pooled connection.
  const found = Object.entries(process.env)
    .filter(([k, v]) => /^LICENSE.*_URL/.test(k) && !/NO_SSL|PRISMA/.test(k) && /^postgres(ql)?:\/\//.test((v ?? "").trim()))
    .sort(([a], [b]) => Number(/UNPOOLED|NON_POOLING/.test(a)) - Number(/UNPOOLED|NON_POOLING/.test(b)));
  return found[0]?.[1]?.trim() ?? "";
}

/** Which database holds the codes (for the owner's status panel — never the address). */
export function licenseStorage(): "license-db" | "embedded" {
  return licenseDbUrl() ? "license-db" : "embedded";
}

/** Codes need a database that survives restarts; on Vercel the embedded one does not. */
export const durableStorage = () => !!licenseDbUrl() || !process.env.VERCEL;

export const ownerPasswordSet = () => !!(process.env.LICENSE_ADMIN_PASSWORD ?? "").trim();

/** Serving codes: the owner's password AND durable storage — never on a throw-away database. */
export const codesServerEnabled = () => ownerPasswordSet() && durableStorage();
