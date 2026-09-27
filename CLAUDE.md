# CLAUDE.md — Spir-Margin project map

Read this first. It says the rules that are not negotiable, where to start looking, and the traps
already paid for once. The full map is `docs/MAP.md`; the file index is `docs/FILES.md`. The Arabic, owner-facing version of this map
is in `README.md`.

## What it is

A medical-device / lab-supplies business app (sales, purchasing, stock, kits
with expiry, installed devices, maintenance, banking, reports) for **one company
in Iraq**. Next.js 14 App Router + an **embedded Postgres (PGlite)** on each
computer. **Web first:** Vercel deploys `main`; the web app `/app` runs the whole program in the
browser (its own PGlite) and syncs with the company database. The installed Windows version is
**closed** in `windows-archive/` (not built, tested or released; kept as it is for later — see its
README). Computers still sync with each other (office network) and with a hosted Postgres.

## Non-negotiable rules

- **UI is Arabic only.** Every visible string goes through `t(locale, "English key")`
  (`src/lib/i18n.ts`) with an Arabic value. English stays in the dictionary but is
  never selected (`src/lib/i18n-server.ts` always returns `ar`). Do not delete English.
- **Western digits (1234), never Arabic-Indic (١٢٣٤).** Browser suites check this.
- Talk to the user in Arabic. Code, comments, commits: English.
- Real data only: a new database starts **empty** (`SPIR_SEED` default `none`).
- The program listens on **127.0.0.1** only. Other devices reach it only through the
  sync port (3310, sealed) or the **remote-access gateway** (3300, off by default,
  switched on by an admin on /sync; browsers must pair with a one-time code; it marks
  requests `x-spir-remote: 1` and the built-in account is refused on them).
- Commit messages end with the attribution lines the session gives. No model names.
- **Merging: the owner does not want to be asked.** Work on the session branch, open a PR, and merge it
  into `main` yourself (squash) as soon as CI passes — no approval step. Never push straight to `main`:
  every change to `main` is deployed by Vercel to every browser, so it must pass CI first.
  A red CI is fixed, never merged. Still ask before anything destructive to data or the hosted DB.

## Commands

```bash
npm run dev                  # http://localhost:3000, data in ./.pglite-data
npm run build && npm start   # production
npx tsc --noEmit && npm run lint
npm test                     # node --test tests/*.test.mjs  (~4 min, PGlite in memory)
npm run schema               # rebuild supabase/schema.sql after adding a migration (a test checks it)
SPIR_TEST_SKIP_BUILD=1 PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium node scripts/test-browser.mjs [filter[,filter…]]
```
Browser runner: builds (unless skipped), starts its own server on **:3399** with a
temp data dir and `SPIR_SEED=demo`, runs `tests/browser/*.mjs` alphabetically.
Full run ≈ 35 min. Run unit and browser tests **sequentially**, never in parallel.

## Architecture in one screen

```
browser ─ /app (web app) ── PGlite in a worker (IndexedDB) ── the same migrations and RPCs
   │         └─ sync: cloudPeer → POST /api/cloud ─┐   license: /api/license/{activate,check,signup,errors}
   │                                               ▼
   └─ server pages ── Next.js on Vercel ── rest.ts (access guard) ── getDb() / companyDb(url) ── company DB
                         └─ codes server /licenses (owner) ── LICENSE_DATABASE_URL or embedded
```
- All business logic is Postgres functions/triggers in `supabase/migrations`: the same SQL in the browser,
  on the server and on the hosted DB. Screens call the RPCs; they never re-implement a rule.
- `src/lib/db/rest-core.ts` is the one supabase-js-shaped query builder, used by the web app and the server
  (`rest.ts` adds the ACCESS GUARD per query: server actions are callable by id from any page, even `/login`).
- Server pages: the middleware (`src/middleware.ts`, edge) checks the cookie signature only; the root layout
  (`src/app/layout.tsx`) checks the session is still valid (`readSession` → `/login/expired`) and the license.
- The server-side background (`src/instrumentation-node.ts`: sync every 60 s, LAN listener :3310 on a main
  computer, auto backup, prune) runs wherever the Next.js server runs; it was built for the installed version.

## Where to look (the full map is `docs/MAP.md`; every file with one line is `docs/FILES.md`)

Open `docs/MAP.md` before a change that spans areas: it has the parts, how a request/record/code travels, every
feature with its files (§5), every page with its action files (§6), the tests (§7) and recipes (§4). To find a
single file: `grep -n <name> docs/FILES.md`. After adding/moving/removing a source file: `npm run map`.

| Area | Start at |
| --- | --- |
| Web app `/app` (the product) | `src/components/local/LocalApp.tsx` (shell, `route()`), `src/lib/local/runtime.ts` (engine), `src/lib/local/registry.ts` (pages as data → `components/local/entity.tsx`), `public/offline-sw.js` + `AppInstall.tsx` (offline copy, updates), `scripts/prepare-local-app.mjs` |
| Web app sync | `src/lib/cloud/serve.ts` (`cloudPeer`, `serveCloud`), `auth.ts`, `src/app/api/cloud/route.ts`, `companyDb` in `src/lib/db/pglite.ts` |
| Codes (licenses) | codes server `src/lib/license/core.ts` + `server.ts`, `/api/license/*`, owner panel `src/app/licenses/page.tsx` + `components/licenses/*`; judging `license/state.ts`; stations `license/modules.ts`; browser side `src/lib/local/license.ts`; installed side `license/device.ts` |
| Business rules | `supabase/migrations/*.sql` (functions, triggers; titles in `docs/FILES.md`) |
| Query builder | `src/lib/db/rest-core.ts` (shared), `rest.ts` (server + access guard), `lib/supabase/server.ts` (clients) |
| Sync algorithm | `src/lib/sync/core.ts` (framework-free), `engine.ts` (server upstream), `lan.ts`/`seal.ts`/`code.ts` (office network) |
| Server pages | `src/app/<route>/page.tsx`, actions `src/app/actions/<area>.ts`, screens `src/components/<area>/`, sidebar `src/lib/nav.ts`, layout/gate `src/app/layout.tsx`, `src/middleware.ts` |
| Text | `src/lib/i18n.ts` (`t`, `tStatus`, `tValue`) |
| Stations (HR, cold chain, guides) | rules pure in `src/lib/{hr,coldchain,guides}/core.ts`, pages `/hr/*`, `/cold-chain/*`, `/guides/*` |
| Help | `src/components/help/topics.tsx` |
| Closed Windows version | `windows-archive/` (README: files, origins, restore) — never import from it |

## Database

- `supabase/migrations/NNNN_name.sql`, applied in order by the app's own migrator
  (`applyPendingMigrations` in `pglite.ts`) on the local DB **and** on the hosted DB at
  first contact; ledger `_spir_migrations`. Never `supabase db push`.
- New migration: next number; idempotent; if it adds a **table** end with
  `select _spir_attach_change_log();`, if it adds a **trigger** end with
  `select _spir_guard_triggers();`; then `npm run schema`.
- `_spir*` tables are local to each computer and never synced (node id, sync state,
  peer, LAN server/clients, branding, doc counters, backup settings, built-in password).
- Migrations run with `spir.syncing = on`: their data changes are not logged.
- Key migrations: 0059 auth · 0072 feature flags · 0089 change log · 0095 branding/doc
  numbers · 0102 Arabic errors · 0103 session cut-off · 0104 closes Supabase REST
  (anon/authenticated) · 0105 sync links · 0106 trigger sync guard · 0107 no default
  accounts · 0108 prune standalone · 0109 built-in password · 0110 auto backup ·
  0111 sync renames · 0112 auto update · 0113 remote access · 0114 Arabic search · 0115 device license · 0116 code sign-in · 0117 staff & shifts · 0118 cold chain · 0119 document verify key · 0120 guides & training · 0121 sync same-moment tie-break. Full list with titles in `README.md`.

## Sync model (read before touching sync)

- Every DB logs row changes in `_spir_changes` (origin node, origin_seq, row JSON).
  `_spir_apply_change` applies one change last-writer-wins via `_spir_row_version`
  and sets `spir.syncing=on` so the change log and **all business triggers** skip it
  (0106) — derived rows (journal entries…) travel in the log themselves.
- One upstream per computer: hosted DB (`_spir_peer.database_url` or `DATABASE_URL`)
  or a main computer (`_spir_peer.lan_code`). A main computer serves others and may
  itself link to the hosted DB → tree: office PCs → main → hosted ← branches.
- Relay: received changes are recorded with `received_from` (`remote`, `lan`,
  `n:<node>`); a peer is sent everything except what came from it.
- Joining: an empty computer linking to a main computer takes a **clone**
  (`adoptClone`: new node id, cleared doc prefix/links, gateway off, devices cleared).
  A computer with records of its own is merged only after confirming (`confirm_merge`,
  the main computer's company name and the record count are shown). On a gap (peer log pruned
  past the cursor) a **full copy** (`snapshotFrom`) is taken.
- Duplicate unique codes: the side that has not delivered yet renames its value
  `CODE-XXXX` (`renameOnConflict`, logged in `_spir_sync_renames`); emails and
  referenced values are never renamed.

## Traps already hit (do not repeat)

- `select seq::text as seq … order by seq` sorts **as text** ("114" < "5"). Order by the column (`c.seq`).
- `revalidatePath` in an action can remount the form and drop `useFormState` results →
  on success **redirect** with `?done=…`/`?changed=1` and render the message server-side.
- Next loads modules more than once (pages vs actions vs instrumentation): keep
  singletons/caches/locks on `globalThis` (`__spirLocal`, `__spirSessionCache`, `__spirSyncRun`, `__spirLan`…).
- `instrumentation.ts` must import node code only inside `if (process.env.NEXT_RUNTIME === "nodejs")`.
- Supabase: no `session_replication_role` for users; the **transaction pooler (6543)**
  breaks the migrator's advisory lock — use Session pooler (5432); REST API closed (0104);
  per-schema `ALTER DEFAULT PRIVILEGES` cannot revoke PUBLIC EXECUTE — also do it globally.
- PGlite instances in tests are ~100 MB each: close them (`afterEach`) or tests crawl.
- Test pages: the header also has a «مزامنة الآن» button; the Settings page has two file
  inputs (logo first); `role="alert"` also matches Next's empty route announcer;
  a click before hydration is lost — retry or wait.
- `pkill -f next` also kills your own shell; find PIDs with `ps` + `awk`.
- (archived Windows files) `.ps1` must stay UTF-8 **with BOM** + CRLF; `.vbs` with Arabic must be UTF-16 — `.gitattributes` keeps them intact.
- Restore must never delete data before the file is proven valid (it is opened in memory first).
- Next names itself `localhost:PORT` in redirects; the gateway rewrites those to relative
  paths (`ownAddressToPath`) or remote devices are sent to their own localhost.
- Session cookies are `Secure` only when the request is not remote (`secureCookies()`):
  browsers drop Secure cookies on plain http from another address.
- `next start` leaves a `next-server` child: kill it too (it keeps the ports) — `ps` for `next-server`.
- Invoice/PO numbers left blank are minted by `fn_next_doc_no` (the columns are not null; a blank
  number used to fail silently). Forms must show `res.error` — never swallow a failed save.
- Re-rendering a `<select>`'s options (optgroups) replaces them and loses an uncontrolled choice:
  `RecentOptions` restores it — do the same in any component that reorders options.
- A row button is a `<ValidatedForm action={xForm}>`, never a plain `<form action>`: a plain form drops
  what the action returns, so a refused submit/cancel/pay looked like a dead button. Every `…Form(fd)`
  wrapper returns `{ error }` on failure (the inner `{ ok, error }` or `formError(error)`); client forms show
  `res.error` with `SaveError`.
- `raise exception` (P0001) texts are for the person and are shown as they are; `formError` used to throw
  them onto the error screen. Branch on `error.code` (23505…), never on message text — `rest.ts` rewrites
  constraint messages into Arabic.
- A stored choice (`spare_part`, `under_warranty`, "Sales Invoice") is shown with `tValue(locale, v)`,
  never `v.replace(/_/g, " ")`; `RecordDetail` does it for `…type/status/purpose…` columns.
- Activation codes: every build asks `DEFAULT_LICENSE_SERVER` (the owner's site, https://spir-margin-three.vercel.app);
  codes are off while that site answers `enabled: false` (no `LICENSE_ADMIN_PASSWORD` / codes DB). The
  browser runner forces `SPIR_LICENSE_SERVER=""`, so no suite but `e2e-license.mjs` (its own servers :3395/:3394/:3393/:3391, and a not-a-codes-server stub on :3392)
  ever meets the activation window. A server set but never reached counts as ON (the first registration needs
  the internet). `_spir_license` is kept across a restore; only a real refusal (stopped/expired/moved/deleted) locks.
- A code's database link is applied by `planCompanyLink` only where it cannot hurt: never over the company's own
  link, an office computer's main computer, or a deployed `DATABASE_URL`; a link from the code cannot be changed
  on the Sync page (the provider changes it on `/licenses`).
- Web app: `PGliteWorker.create` options are posted to the worker — no functions (type parsers live in the generated
  `db-worker.js`); anything the app fetches (`/pglite`, `/spir`) must be public in the middleware or it gets the
  welcome page's HTML; `LocalApp` renders only after mount (the runtime needs `window`).
- Last-writer-wins must order changes of the same moment: every change in one transaction has the same `changed_at`
  (`now()`), so a row written twice in one call (a payment, then its status refresh) lost its second change on the
  receiving side until 0121 added `origin_seq` to `_spir_row_version` and to `_spir_apply_change` (7th argument).
- Web app offline copy: the worker's app cache is versioned by what `/app` names; anything the app fetches must be
  listed for `prepare` (engine files come from `local.json` `files`) or it will be missing offline. Relaxed durability
  means "the query answered" is not "it is on disk": never keep a flag outside the database that claims a write
  (the schema check reads `_spir_migrations`).
- (archived updater) An update must never move `.pglite-data`, `.env.local`, `backups`, `logs` or `updates` (`$Keep` in
  `update.ps1`); the build in the stage folder writes its own `.env.local` and `.pglite-data` — never swap them in.

## Tests

- Unit (`tests/*.test.mjs`): PGlite + real migrations (`tests/helpers.mjs`: `bootWithMigrations`,
  `bootWithSchemaFile`, `loadSeed`, `importTs` runs a self-contained `src/**/*.ts` as is). `schema.test.mjs`
  (schema.sql current), `local-registry.test.mjs` (web app pages vs schema), `map.test.mjs` (FILES.md current).
- Browser (`tests/browser/*.mjs`, harness `harness.mjs`, runner on :3399): `crawl.mjs` (every route in
  `routes.txt`: Latin text / Arabic-Indic digits / console errors), `record-pages.mjs` (runs last),
  `e2e-webapp.mjs` (the web app end to end, codes server :3389), `e2e-license.mjs` (codes server + computers),
  `e2e-lan-sync.mjs`, `e2e-builtin.mjs` (restores 123 at the end). What each suite covers: `docs/MAP.md` §7.

## Docs

`docs/MAP.md` (the full map) · `docs/FILES.md` (generated file index, `npm run map`) · `windows-archive/README.md` (the closed Windows version) · `docs/HOSTED-SETUP.md` (Supabase +
Vercel demo) · `docs/DEPLOYMENT.md` · `supabase/migrations/README.md` (migration rules) ·
`tests/browser/README.md`.
