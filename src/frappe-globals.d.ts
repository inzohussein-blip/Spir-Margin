// Ambient globals used by the ported banking helpers (originally injected by
// the Frappe desk runtime). Declared loosely so the vendored code type-checks.
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  frappe?: any;
}
