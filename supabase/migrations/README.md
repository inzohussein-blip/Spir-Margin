# Migrations

Numbered SQL files, applied in filename order. Everything about the database
schema lives here — `../schema.sql` is generated from these files and
`../seed.sql` only inserts rows.

## Adding one

1. Create `NNNN_short_name.sql` with the next free number. Filenames must match
   `^[0-9]{4}_[a-z0-9_]+\.sql$`; `tests/schema.test.mjs` enforces that, and that
   no two files share a number.
2. Write it so it can be applied to a database that already has the previous
   ones — `create table if not exists`, `add column if not exists`,
   `create or replace function`, and a guard around anything that inserts.
3. Rebuild the combined file: `npm run schema`.
4. `npm test`.

## How they get applied

| Where | How |
| --- | --- |
| Embedded PGlite (local / trial build) | `src/lib/db/pglite.ts` replays every file once at first boot |
| Hosted Postgres | the same migrator at startup, or `psql -f ../schema.sql` by hand |

Both record each filename in the `_spir_migrations` ledger, so a file is never
applied twice. `../schema.sql` writes the whole ledger up front, which is why a
database stood up from it does not then replay anything.

## Conventions

- **The demo seed is not part of the schema.** `../seed.sql` is a separate,
  optional step. It calls `fn_create_portal_user`, which writes the `customer`
  enum label that `0070` adds, and Postgres refuses a new enum value inside the
  transaction that created it — so it cannot be folded into `schema.sql`, and it
  has no business in a production database anyway.
- **Every foreign key gets an index.** Postgres indexes the referenced side but
  not the referencing one, so an unindexed FK makes every parent delete scan the
  whole child table. `0088` covers the ones that had accumulated; a test fails if
  a new table reintroduces the problem.
- **No table gets RLS without a policy.** RLS with no policy denies every row to
  a non-superuser, which reads as an empty table rather than an error. Also
  covered by a test.
- **Master data is Arabic.** The UI is Arabic-only; `0087` translates the names
  seeded by `0012`–`0052`. Brand names and unit symbols (L, mL, kg) stay as they
  are.

## Two known irregularities

- **`0028` does not exist.** A historical gap. Renumbering the files after it
  would change names already recorded in the ledger of every deployed database,
  which would make the migrator replay 59 files — so the gap stays.
- **`0004` and `0059` are forward-only.** Later migrations redefine the view
  columns and function signatures they create, so replaying either on a fully
  migrated database errors instead of reverting them. That is the intended
  outcome; the ledger is what keeps it from happening. Every other file,
  including `0087`, can be replayed safely.
