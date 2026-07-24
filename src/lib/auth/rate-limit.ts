import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Login throttle backed by the `login_attempts` table (migration 0083): after
 * 5 failed attempts for an email within 15 minutes, further attempts are locked
 * for 15 minutes. Persisting in the database (rather than process memory) makes
 * the lockout survive restarts and hold across every server instance.
 */

/** Seconds remaining on a lockout for this email, or 0 if not locked. */
export async function lockoutRemaining(email: string): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.rpc("fn_login_lockout_remaining", { p_email: email });
  return Number(data ?? 0);
}

/** Record a failed attempt; locks the email once the limit is hit. */
export async function recordFailure(email: string): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("fn_login_record_failure", { p_email: email });
}

/** Clear the counter for an email after a successful sign-in. */
export async function recordSuccess(email: string): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("fn_login_record_success", { p_email: email });
}
