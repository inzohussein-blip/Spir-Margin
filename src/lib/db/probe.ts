import "server-only";

/**
 * Checking a hosted Postgres address before it is used — shared by the Sync
 * page (a computer links its own) and the codes server (the owner links a
 * company's database to its code).
 */

/**
 * The address without the password: host and database name are enough to
 * tell one server from another.
 */
export function databaseHost(url: string): string {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, "");
    return db ? `${u.host}/${db}` : u.host;
  } catch {
    return "…";
  }
}

/** Open a connection and close it, so a bad address is caught before saving. Null when it works. */
export async function probeDatabase(url: string): Promise<string | null> {
  const pgLib = (await import("pg")).default as typeof import("pg");
  const client = new pgLib.Client({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    await client.end().catch(() => undefined);
  }
}
