import "server-only";
import { getDb } from "@/lib/db/pglite";
import { upstream } from "@/lib/sync/engine";
import { readBackupSettings } from "./auto";
import { copyState, type CopyState } from "./copies";

/** This computer's copy state, from what it knows. Never throws. */
export async function currentCopyState(): Promise<CopyState | null> {
  try {
    const { db } = await getDb();
    const one = async <T,>(sql: string, params: unknown[] = []): Promise<T | null> => {
      try {
        return (await db.query<{ v: T | null }>(sql, params)).rows[0]?.v ?? null;
      } catch {
        return null;
      }
    };
    const up = await upstream();
    const [records, upstreamAt, officeAt, backup] = await Promise.all([
      one<number>(`select count(*)::int as v from _spir_changes`),
      // The last pass that completed with the computer it syncs with, if it still has one.
      up ? one<string>(`select last_sync_at::text as v from _spir_sync_state where peer = $1`, [up.key]) : null,
      one<string>(`select max(last_seen)::text as v from _spir_lan_clients`),
      readBackupSettings().catch(() => null),
    ]);
    // Only a folder chosen outside the program's own counts: a backup on the
    // same disk is lost with it.
    const outside = backup && backup.folder && !backup.lastError ? backup.lastRunAt : null;
    return copyState(
      { hasRecords: (records ?? 0) > 0, upstreamSyncAt: upstreamAt, officeSyncAt: officeAt, outsideBackupAt: outside },
      new Date(),
    );
  } catch {
    return null;
  }
}
