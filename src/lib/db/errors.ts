import { t, type Locale } from "@/lib/i18n";

/**
 * Turn a database rejection into a sentence the person who caused it can act
 * on.
 *
 * Saving a duplicate code used to throw the raw Postgres text, which the
 * error boundary rendered as "something went wrong" — the one thing it was
 * not. Postgres already says precisely what it refused and why, so the
 * SQLSTATE and the constraint name are all that is needed to say it plainly.
 */

export interface DbErrorLike {
  message: string;
  code?: string;
  constraint?: string;
  detail?: string;
  /** Postgres names the column directly on a not-null violation. */
  column?: string;
  /** …and the table on every constraint violation. */
  table?: string;
}

/**
 * Recover the column from a default constraint name: Postgres builds them as
 * `<table>_<column>_key` / `_fkey` / `_pkey`. A hand-named constraint will not
 * match, and then the message stays general rather than wrong.
 */
function columnOf(constraint: string | undefined, table?: string): string | null {
  if (!constraint) return null;
  // With the table known the split is exact: "sales_stages" + "_name_key".
  if (table && constraint.startsWith(`${table}_`)) {
    const rest = /^(.+?)_(?:key|fkey)$/.exec(constraint.slice(table.length + 1));
    if (rest) return rest[1];
  }
  const m = /^[a-z0-9]+(?:_[a-z0-9]+)*?_([a-z0-9_]+?)_(?:key|fkey)$/.exec(constraint);
  return m?.[1] ?? null;
}

/** `Key (code)=(LAB-001) already exists.` → `LAB-001` */
function valueOf(detail: string | undefined): string | null {
  return /\)=\(([^)]*)\)/.exec(detail ?? "")?.[1] ?? null;
}

/**
 * A readable message, or null when this is not a failure the person can fix —
 * those should keep throwing so they are logged and surfaced as real faults
 * rather than dressed up as validation.
 */
export function describeDbError(locale: Locale, err: DbErrorLike): string | null {
  const column = columnOf(err.constraint, err.table);
  const field = column ? t(locale, fieldKey(column)) : null;
  const value = valueOf(err.detail);

  switch (err.code) {
    case "23505": {
      // Unique violation — by far the common one: a code or serial reused.
      if (field && value) {
        return `${t(locale, "Already used:")} ${field} «${value}»`;
      }
      if (field) return `${t(locale, "This value is already used in")} ${field}`;
      return t(locale, "A record with these details already exists");
    }
    case "23503":
      // Foreign key — either the parent is missing or the row is still in use.
      return t(locale, "This record is linked to others, so it cannot be saved or removed as is");
    case "23502":
      return err.column
        ? `${t(locale, "Required field:")} ${t(locale, fieldKey(err.column))}`
        : t(locale, "A required field is empty");
    case "23514":
      // Raised by a function (no constraint named): its own text says more.
      if (!err.constraint && err.message) return t(locale, err.message);
      return t(locale, "One of the values is outside what this field allows");
    case "22001":
      return t(locale, "One of the values is too long");
    case "P0001":
      // A business rule refused it (`raise exception` in a function):
      // "not enough stock", "payment exceeds what is owed". Those texts are
      // written for the person (Arabic since 0102) and name what to fix, so
      // they are shown as they are instead of an error screen.
      return err.message ? t(locale, err.message) : null;
    default:
      return null;
  }
}

/** Column names double as i18n keys where the app already has a label. */
function fieldKey(column: string): string {
  const known: Record<string, string> = {
    code: "Code",
    name: "Name",
    email: "Email",
    phone: "Phone",
    serial_no: "Serial no.",
    asset_code: "Asset code",
    item_code: "Item code",
    batch_no: "Batch no.",
    invoice_no: "Invoice no.",
    account_name: "Account name",
    account_number: "Account number",
  };
  return known[column] ?? column;
}
