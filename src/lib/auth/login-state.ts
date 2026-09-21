/**
 * Client-facing return type for the sign-in server action.
 *
 * Kept in its own file (not the "use server" module) so client components can
 * `import type` it without pulling any server code into the client bundle.
 * `error` is a translation KEY that the login form looks up per locale.
 */
export type LoginState =
  | null
  | { error: string; lockedFor?: number };
