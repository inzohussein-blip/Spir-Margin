/**
 * Is there a recent copy of this computer's records anywhere else? Pure, so
 * the tests import it as is.
 *
 * The main computer is now the company's database: if its disk fails and
 * nothing else holds the records, they are gone. A copy is any of:
 *   - the computer it syncs with (the main computer, or the hosted database),
 *     as of its last successful sync;
 *   - an office computer that took a full copy from it and keeps syncing,
 *     as of when one last did;
 *   - an automatic backup written to a folder chosen outside the program's
 *     own (another drive, a USB stick, a shared folder), as of the last one
 *     that worked.
 */

export interface CopyFacts {
  /** Whether there are any records worth losing yet. */
  hasRecords: boolean;
  /** Last successful sync with this computer's upstream, if it has one. */
  upstreamSyncAt: string | null;
  /** When an office computer last synced with this one (as main computer). */
  officeSyncAt: string | null;
  /** Last successful automatic backup to a folder outside the program's. */
  outsideBackupAt: string | null;
}

export type CopyKind = "upstream" | "office" | "backup";

export interface CopyState {
  /** The newest copy elsewhere, and what it is. */
  newest: { at: string; kind: CopyKind } | null;
  /** Records exist and no copy is recent enough. */
  atRisk: boolean;
  /** Whole days since the newest copy (null: there has never been one). */
  daysSince: number | null;
}

/** Older than this, a copy no longer counts. */
export const FRESH_DAYS = 3;

export function copyState(f: CopyFacts, now: Date): CopyState {
  const candidates: { at: string; kind: CopyKind }[] = [];
  if (f.upstreamSyncAt) candidates.push({ at: f.upstreamSyncAt, kind: "upstream" });
  if (f.officeSyncAt) candidates.push({ at: f.officeSyncAt, kind: "office" });
  if (f.outsideBackupAt) candidates.push({ at: f.outsideBackupAt, kind: "backup" });
  const valid = candidates.filter((c) => Number.isFinite(Date.parse(c.at)));
  valid.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const newest = valid[0] ?? null;
  const daysSince = newest ? Math.floor((now.getTime() - Date.parse(newest.at)) / 86_400_000) : null;
  const fresh = daysSince !== null && daysSince < FRESH_DAYS;
  return { newest, atRisk: f.hasRecords && !fresh, daysSince };
}
