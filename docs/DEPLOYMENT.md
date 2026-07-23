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
```

`supabase/schema.sql` is the full schema (all migrations + a demo seed) and is
kept in sync with `supabase/migrations/`. For a clean production database, apply
the numbered migrations and skip the demo seed section at the bottom.

## 2. Required configuration

| Variable | When | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | **Required** on any hosted deploy | Signs session cookies. Without it the app refuses to start on a hosted deploy (it would otherwise use a public built-in key that lets anyone forge a session). Generate with `openssl rand -base64 48`. |
| `DATABASE_URL` | Hosted Postgres | Connection string; unset = embedded PGlite. |

The first user is seeded as `admin@spir.local` / `admin1234` — **change this
password immediately** (Setup → Users) after the first sign-in.

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
