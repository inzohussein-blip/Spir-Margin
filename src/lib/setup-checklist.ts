import "server-only";
import { getDb } from "@/lib/db/pglite";
import { builtinPasswordChanged } from "@/lib/auth/builtin";

/**
 * First steps for a company starting on this computer, shown to an
 * administrator on the home page until they are done. A new install is
 * empty by design; this is what turns it into this company's own.
 */

export interface SetupStep {
  key: "company" | "password" | "accounts" | "backups";
  done: boolean;
  href: string;
}

export async function setupSteps(): Promise<SetupStep[]> {
  const { db } = await getDb();
  const one = async <T,>(sql: string, fallback: T): Promise<T> => {
    try {
      return ((await db.query<{ v: T }>(sql)).rows[0]?.v ?? fallback) as T;
    } catch {
      return fallback;
    }
  };
  const [company, accounts, folder, password] = await Promise.all([
    one<string | null>(`select nullif(trim(company_name), '') as v from _spir_branding`, null),
    one<number>(`select count(*)::int as v from app_users where role <> 'customer'`, 0),
    one<string | null>(`select nullif(trim(folder), '') as v from _spir_backup`, null),
    builtinPasswordChanged(),
  ]);
  return [
    { key: "company", done: !!company, href: "/settings" },
    { key: "password", done: password, href: "/settings#builtin" },
    { key: "accounts", done: accounts > 0, href: "/users" },
    { key: "backups", done: !!folder, href: "/settings#auto-backup" },
  ];
}
