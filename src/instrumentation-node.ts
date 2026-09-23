import { applyServerSetting } from "@/lib/sync/lan";
import { runSync, upstream } from "@/lib/sync/engine";

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
  }, 5_000);

  setInterval(() => {
    upstream()
      .then((up) => (up ? runSync() : null))
      .catch((e) => console.error("[sync] background pass failed:", (e as Error).message));
  }, INTERVAL_MS).unref();
}
