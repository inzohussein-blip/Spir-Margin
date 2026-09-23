# Deploying Spir-Margin to production

Spir-Margin runs on two interchangeable data backends behind one interface.
Choose based on how durable the data must be.

## 1. Data backend

### Embedded PGlite (zero-config — demo / single machine)
Leave `DATABASE_URL` unset. The app runs an in-process Postgres (PGlite) that
stores everything in `./.pglite-data`. Migrations are applied automatically on
boot. Great for demos and a single always-on machine — **but the data lives in
one directory on one server**, so it is only as safe as that disk.

### Hosted Postgres (recommended for a real business)
Set `DATABASE_URL` to a managed Postgres (Supabase, Neon, RDS, Cloud SQL, …):

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
# PGSSL=disable        # only for a local Postgres without TLS
# PGPOOL_MAX=5         # connection pool size
```

Apply the migrations to that database **before first use** (in order):

```
# psql, or your platform's SQL runner, over supabase/migrations/*.sql in order,
# or apply the single combined file:
psql "$DATABASE_URL" -f supabase/schema.sql

# optional — demo data, for a staging or evaluation database only:
psql "$DATABASE_URL" -f supabase/seed.sql
```

`supabase/schema.sql` is every migration concatenated, schema only — no demo
data — so it is safe to run against a production database as-is. It is a
generated file: rebuild it with `npm run schema` after adding a
migration, and `npm test` fails if it drifts.

## 2. Required configuration

| Variable | When | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | **Required** on any hosted deploy | Signs session cookies. Without it the app refuses to start on a hosted deploy (it would otherwise use a public built-in key that lets anyone forge a session). Generate with `openssl rand -base64 48`. |
| `DATABASE_URL` | Optional | A hosted Postgres to SYNC with. The app always stores its data in its own embedded database; this adds a peer it pushes to and pulls from. Unset means this machine runs standalone. |
| `SPIR_SEED` | Optional | What a brand-new database starts with: `none` (default, empty for real data), `demo`, or `full`. |

No database account is created (migration `0107` removed the old
`admin1234` / `demo1234` ones). Sign in with the built-in account
`admin@spir.local` / `123`, then change its password in Settings → Built-in
account password, and create an account for each person under Setup → Users.

> For the hosted database (Supabase) and the public demo on Vercel, see
> [`HOSTED-SETUP.md`](./HOSTED-SETUP.md).

## 3. Backups

- **Hosted Postgres:** use the provider's automated backups / PITR, or schedule
  `pg_dump "$DATABASE_URL" > backup-$(date +%F).sql`. For a business handling
  real money, verify restores periodically.
- **Embedded PGlite:** back up the whole `./.pglite-data` directory (stop the
  app or copy atomically). This is a last resort — prefer hosted Postgres for
  anything beyond a demo.

## 4. Build & run

```
npm ci
npm run build
npm start          # serves on $PORT (default 3000)
```

CI (`.github/workflows/ci.yml`) runs lint, tests and build on every push/PR.

## 5. Notes

- All money paths (POS, sales orders, the Record-Sale form) book through one
  cost-authoritative, idempotent path, deduct stock (kits) and post balanced
  double-entry journal entries automatically.
- Login is rate-limited (5 failed attempts → 15-minute lockout, per process).
  A multi-instance deployment should front this with a shared limiter.
- Every edit and deletion of money/compliance records is captured immutably and
  attributed to the acting user (Monitoring → Change & Deletion Log). Actor
  attribution is active on the embedded backend; on pooled Postgres it is
  skipped to avoid cross-request leakage (see `src/lib/audit/actor.ts`).
