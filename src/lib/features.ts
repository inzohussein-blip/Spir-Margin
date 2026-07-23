import "server-only";
import { createClient } from "@/lib/supabase/server";
import { navGroups } from "@/lib/nav";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Feature settings & access control.
 *
 * A "feature" is one of the app's module groups (Selling, Buying, Stock, …).
 * Two independent controls, both admin-managed and both stored in the DB
 * (migration 0072):
 *
 *   - Global three-state flag per feature: enabled | disabled | hidden.
 *   - Per-account deny list (user_feature_access): a row = that account may
 *     not use that feature.
 *
 * Core features can never be disabled or hidden, and admins are never
 * restricted — this guarantees there is always a way back into Settings.
 */

export type FeatureState = "enabled" | "disabled" | "hidden";

/** Features that must always stay on and reachable (the escape hatch). */
export const CORE_FEATURES = new Set<string>(["Home", "Setup"]);

/** Every feature key, in sidebar order. */
export const ALL_FEATURES: string[] = navGroups.map((g) => g.label);

/** The features an admin may toggle (everything that isn't core). */
export const TOGGLEABLE_FEATURES: string[] = ALL_FEATURES.filter((f) => !CORE_FEATURES.has(f));

// Longest href first, so /sales-orders/new resolves before a shorter prefix.
const PATH_INDEX: { href: string; feature: string }[] = navGroups
  .flatMap((g) => g.items.map((i) => ({ href: i.href, feature: g.label })))
  .filter((e) => e.href !== "/")
  .sort((a, b) => b.href.length - a.href.length);

/** Which feature a given path belongs to (or null if it maps to none/core). */
export function featureForPath(pathname: string): string | null {
  const hit = PATH_INDEX.find((e) => pathname === e.href || pathname.startsWith(e.href + "/"));
  return hit ? hit.feature : null;
}

export interface AccessContext {
  role: SessionUser["role"];
  /** feature -> state (only non-default entries are present) */
  flags: Map<string, FeatureState>;
  /** features this specific account may not use */
  denied: Set<string>;
}

/** Load the current user's access context (global flags + their deny list). */
export async function getAccessContext(user: SessionUser): Promise<AccessContext> {
  const flags = new Map<string, FeatureState>();
  const denied = new Set<string>();
  try {
    const supabase = createClient();
    const [flagRes, denyRes] = await Promise.all([
      supabase.from("feature_flags").select("feature, state"),
      supabase.from("user_feature_access").select("feature").eq("user_id", user.id),
    ]);
    for (const r of (flagRes.data as { feature: string; state: FeatureState }[] | null) ?? []) {
      flags.set(r.feature, r.state);
    }
    for (const r of (denyRes.data as { feature: string }[] | null) ?? []) {
      denied.add(r.feature);
    }
  } catch {
    // Tables not migrated yet, or a transient read error — default to full access.
  }
  return { role: user.role, flags, denied };
}

/** Effective state of a feature for this account (admins always "enabled"). */
export function effectiveState(feature: string, ctx: AccessContext): FeatureState {
  if (ctx.role === "admin" || CORE_FEATURES.has(feature)) return "enabled";
  if (ctx.denied.has(feature)) return "disabled";
  return ctx.flags.get(feature) ?? "enabled";
}

/** Can this account open a page under the given path? */
export function isPathAllowed(pathname: string, ctx: AccessContext): boolean {
  const feature = featureForPath(pathname);
  if (!feature) return true; // unmapped route (account, settings, workspaces…)
  return effectiveState(feature, ctx) === "enabled";
}

/**
 * Why a path is blocked for this account, or null if it's allowed.
 * "denied"   → this account was specifically denied the feature.
 * "disabled" → the feature is globally disabled or hidden.
 */
export function blockReason(pathname: string, ctx: AccessContext): "denied" | "disabled" | null {
  if (ctx.role === "admin") return null;
  const feature = featureForPath(pathname);
  if (!feature || CORE_FEATURES.has(feature)) return null;
  if (ctx.denied.has(feature)) return "denied";
  const st = ctx.flags.get(feature);
  return st === "disabled" || st === "hidden" ? "disabled" : null;
}

/** Nav rendering hints: which feature groups to hide vs. show as "off". */
export function navFeatureState(ctx: AccessContext): { hidden: string[]; off: string[] } {
  const hidden: string[] = [];
  const off: string[] = [];
  for (const f of TOGGLEABLE_FEATURES) {
    const s = effectiveState(f, ctx);
    if (s === "hidden") hidden.push(f);
    else if (s === "disabled") off.push(f);
  }
  return { hidden, off };
}
