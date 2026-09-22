/**
 * Calendar dates in the local time zone.
 *
 * `new Date().toISOString().slice(0, 10)` reads like "today" but is today in
 * UTC. In Iraq (UTC+3) that is yesterday from midnight until 3 a.m., and a
 * date typed as local midnight comes back as the day before. This returns the
 * yyyy-mm-dd the person at this computer would say it is.
 *
 * Safe on both sides: in the browser it is the user's clock, on the server it
 * is the machine's — the same computer, for this app.
 */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
