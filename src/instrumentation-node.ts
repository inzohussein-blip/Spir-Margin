import { applyServerSetting } from "@/lib/sync/lan";
import { consumeResetFile } from "@/lib/auth/builtin";
import { backupTick } from "@/lib/backup/auto";
import { pruneStandalone, runSync, upstream } from "@/lib/sync/engine";
import { updateTick } from "@/lib/update/updates";
import { applyGatewaySetting } from "@/lib/remote/gateway";

/**
 * Work the server does on its own, with no page open.
 *
 * The page's own timer syncs only while someone has the program open. A main
 * computer that boots, starts the program in the background and sits there
 * must still answer the office's computers and pass their work on to the
 * hosted database — so the listener starts here, and a pass runs every minute
 * whenever there is somewhere to sync with.
 */

const INTERVAL_MS = 60_000;
const G = globalThis as unknown as { __spirBackground?: boolean };

if (!G.__spirBackground) {
  G.__spirBackground = true;

  // Give the first page request the database first: booting it runs any
  // pending migrations, and the listener and the timer both need it.
  setTimeout(() => {
    applyServerSetting().catch((e) => console.error("[lan-sync] could not start:", (e as Error).message));
    // Remote access from other devices, if an administrator turned it on.
    applyGatewaySetting().catch((e) => console.error("[gateway] could not start:", (e as Error).message));
    // A forgotten built-in password: a reset file left in the folder puts
    // 123 back (see src/lib/auth/builtin.ts).
    consumeResetFile().catch(() => undefined);
  }, 5_000);

  setInterval(() => {
    // Automatic backups (Settings): runs if the schedule says one is due.
    backupTick().catch((e) => console.error("[backup] tick failed:", (e as Error).message));
    // New releases: asked for a few times a day; installed at the chosen
    // hour if automatic updates are on (Settings → Updates).
    updateTick().catch((e) => console.error("[update] tick failed:", (e as Error).message));
    upstream()
      .then((up) => (up ? runSync() : null))
      .catch((e) => console.error("[sync] background pass failed:", (e as Error).message));
  }, INTERVAL_MS).unref();

  // Hourly: a computer syncing with nothing still forgets month-old changes.
  setInterval(() => {
    pruneStandalone().catch(() => undefined);
  }, 60 * 60_000).unref();
}
