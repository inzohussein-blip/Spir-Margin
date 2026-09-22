import "server-only";
import { getLocale } from "@/lib/i18n-server";
import { describeDbError, type DbErrorLike } from "@/lib/db/errors";

/**
 * How a Server Action reports a rejected save.
 *
 * A violation the person can fix — a code already in use, a required field
 * left empty — comes back as a message the form shows in place, keeping what
 * was typed. Anything else is a genuine fault and keeps throwing, so it is
 * logged and reaches the error boundary instead of being dressed up as
 * validation the user can do something about.
 */
export function formError(error: DbErrorLike): { error: string } {
  const message = describeDbError(getLocale(), error);
  if (!message) throw new Error(error.message);
  return { error: message };
}
