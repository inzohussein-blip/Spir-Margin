/**
 * Build-time platform selector.
 *
 * `SPIR_PLATFORM` is read at bundle time (via Next's `env` passthrough in
 * `next.config.mjs`), so the checks below fold to boolean literals during
 * compilation. Any `if (isCloudBuild) { ...import cloud stuff... }` branch is
 * eliminated from the local bundle and vice versa — no cloud code ships in
 * the local build's binary, and no PGlite ships in the cloud build's binary.
 *
 * Three valid values:
 *   "local"  — trial build: PGlite only, fixed local admin, no rate-limit.
 *   "cloud"  — full build:  hosted Postgres only, fixed cloud admin plus the
 *              regular DB-backed users, brute-force throttle.
 *    unset  — hybrid dev build (both backends compiled in; runtime decides).
 */
const raw = process.env.SPIR_PLATFORM;

export const SPIR_PLATFORM: "local" | "cloud" | "hybrid" =
  raw === "local" ? "local" : raw === "cloud" ? "cloud" : "hybrid";

export const isLocalBuild = SPIR_PLATFORM === "local";
export const isCloudBuild = SPIR_PLATFORM === "cloud";
export const isHybridBuild = SPIR_PLATFORM === "hybrid";
