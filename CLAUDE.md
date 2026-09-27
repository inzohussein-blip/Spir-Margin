# CLAUDE.md — Spir-Margin project map

Read this first. It says where everything is, the rules that are not negotiable,
and the traps already paid for once. The Arabic, owner-facing version of this map
is in `README.md`.

## What it is

A medical-device / lab-supplies business app (sales, purchasing, stock, kits
with expiry, installed devices, maintenance, banking, reports) for **one company
in Iraq**. Next.js 14 App Router + an **embedded Postgres (PGlite)** on each
computer. Installed on Windows PCs with `install-windows.cmd`. Computers sync with
each other (office network) and with a hosted Supabase Postgres (branches).

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
  every change to `main` becomes a release that Windows computers install, so it must pass CI first.
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
browser ── Next.js (127.0.0.1:3000) ── pages (RSC) + server actions
                │
                ├─ src/lib/supabase/server.ts   createClient()/createUserClient()/createPortalClient()/createPublicClient()
                │     └─ src/lib/db/rest.ts      supabase-js-shaped query builder over SQL; the ACCESS GUARD runs per query
                │           └─ src/lib/db/pglite.ts   getDb(): the embedded Postgres (singleton on globalThis), migrations, backup/restore
                │
                ├─ src/instrumentation-node.ts  background: LAN listener, sync every 60 s, auto-backup tick, hourly prune
                ├─ src/lib/sync/*               sync engine (see below)
                └─ LAN listener :3310 (0.0.0.0) only on the "main computer"; 6 sealed ops
```
- All business logic is Postgres functions/triggers in `supabase/migrations`, the same
  SQL locally and on the hosted DB.
- Server actions are callable by id from any page (even `/login`), which is why access
  is enforced in the data layer (`rest.ts` guard), not per action.
- The middleware (`src/middleware.ts`, edge) checks the cookie signature only; the
  root layout (`src/app/layout.tsx`) checks the session is still valid
  (`readSession` → `/login/expired`).

## Where each feature lives

| Feature | Files |
| --- | --- |
| Navigation, groups, icons | `src/lib/nav.ts` (drives sidebar, feature flags, help "features" tab) |
| Translations | `src/lib/i18n.ts` (dict, `tStatus`, `tValue` for stored choice values), `src/lib/i18n-server.ts` |
| Sign-in, sessions | `src/app/actions/auth.ts`, `src/lib/auth/session.ts` (JWT cookie `spir_session`, 7 d), `current-user.ts` (`readSession`), `revocation.ts` (password-cutoff / disabled check, 5 s cache on globalThis), `rate-limit.ts`, `src/app/login/*`, `src/app/login/expired/route.ts` |
| Built-in account `admin@spir.local` | `src/lib/auth/demo-credentials.ts` (id, default pw `123`), `src/lib/auth/builtin.ts` (hash in `_spir_builtin`, reset file `RESET-ADMIN-PASSWORD.txt`), `src/app/actions/builtin.ts`, `components/settings/BuiltinPasswordForm.tsx` |
| Users & roles (admin/manager/staff/customer) | `src/app/users/page.tsx`, `src/app/actions/users.ts`, `components/auth/*` (Create/Reset/ChangePassword forms, UserMenu) |
| Feature flags & per-user access | `src/lib/features.ts` (+ migration 0072), Settings page |
| Company identity, doc numbers, printing | `src/lib/branding.ts`, `components/settings/BrandingPanel.tsx`, `components/print/*`, `fn_next_doc_no` (0095/0098) |
| Sync engine (algorithm) | `src/lib/sync/core.ts` — framework-free, imported by tests as is: push/pull, relay (`received_from`), `servePull`/`serveAccept`, full copy (`serveMeta`/`serveSnapshot`/`snapshotFrom`), clone adoption, conflict renames (`renameOnConflict`) |
| Sync engine (app side) | `src/lib/sync/engine.ts` — upstream choice (hosted `remote` / main computer `lan`), `runSync` lock (10-min stuck guard), status, rejects, renames |
| Office network (LAN) | `src/lib/sync/lan.ts` (listener :3310, ops hello/pull/push/clone/meta/snap, client), `seal.ts` (AES-256-GCM), `code.ts` (`SPIR1-…` sync codes) |
| Sync UI | `src/app/sync/page.tsx`, `src/app/actions/links.ts` (link/unlink/main computer/show code), `components/sync/*`, `components/settings/PeerPanel.tsx` + `actions/peer.ts` (hosted URL, pooler guard) |
| Remote access (0113) | `src/lib/remote/gateway.ts` (listener :3300 on 0.0.0.0, pairing page `/__spir/pair`, device cookie, proxies to 127.0.0.1:PORT, rewrites own-address redirects), `tokens.ts` (pure: pair codes, cookie, Tailscale 100.64/10, limiter), `devices.ts` (`_spir_devices`: browsers + computers with their own sync secret, revoke), `request.ts` (`isRemoteRequest`, `secureCookies`), `actions/remote.ts` (local admin only), `components/sync/RemoteAccessPanel.tsx`; LAN listener picks a computer's secret from header `x-spir-device` (code field `d`) |
| Activation codes (0115) | codes server (the web version on Vercel): `src/lib/license/core.ts` (framework-free, node:crypto only: codes as hashes, seats, ES256 licenses, key sealed with AUTH_SECRET, company DB link sealed, backup), `server.ts` (runner: `LICENSE_DATABASE_URL` Neon or embedded; 2FA TOTP `totp.ts`), `env.ts` (`codesServerEnabled` = `LICENSE_ADMIN_PASSWORD` + durable storage), `owner.ts` (owner cookie), `/api/license` (+`/activate`, `/check`, `/admin`), `/licenses` (code manager: sectioned page `src/app/licenses/page.tsx` + `components/licenses/*` — filter tiles, sort, time bar, trial/presets, activation/reminder WhatsApp messages, each computer's sync report and inactive flag (30 d), payments per month + printable `/licenses/receipt/[id]`, the owner's price plan (`_spir_lic_config.price_plan`), owner action log `_spir_lic_actions` with IP; pure rules in `panel.ts`). Computer: `device.ts` (`_spir_license`, offline verify, `licenseTick` 6 h, `DEFAULT_LICENSE_SERVER` / `SPIR_LICENSE_SERVER`), `state.ts` (pure `judge` — incl. the code's max offline days: license field `off` + signed `iat` → lock reason `offline`, bell notice 3 days before — and `planCompanyLink`); each `/check` also carries the computer's sync report (`syncReport` in `device.ts`), `modules.ts` (the eight stations → nav groups), `company-db.ts` (code's DB → `_spir_peer`), `actions/license.ts`, `components/license/LicensePanel.tsx`; gate in `layout.tsx` (→ `/welcome?activate=1`) and `supabase/server.ts` guard; closed stations in `features.ts` (hidden for admins too). The web version (Vercel, or `SPIR_WEB_LICENSE=1`) is its own codes server and each BROWSER is a device: `web.ts` (`webMode`, cookies `spir_device`/`spir_license`, seat re-checked every 5 min in-process); `/license` redirects to `/licenses` (next.config) |
| Staff & shifts (0117) | ported from spir-lab-manager's roster station, on the database: `hr_employees`, `hr_shift_types`, `hr_roster` + `hr_attendance` (one row per person per day, id = `fn_hr_day_id` so two computers write the same row), `hr_leaves`, `hr_advances`, `hr_settings`; RPCs `fn_hr_set_shift/_set_cover/_copy_week/_set_attendance/_punch`; rules pure in `src/lib/hr/core.ts` (`dayStatus`, `monthSummary`, `payroll`), reads `src/lib/hr/data.ts`, actions `actions/hr.ts`, pages `/hr/*`, `components/hr/*`; station `hr` in `modules.ts`, nav group `HR` |
| Cold chain & calibration (0118) | from spir-lab-manager's quality station: `cc_storage_units` (safe range), `cc_readings` (AM/PM, id from unit+day+slot via `fn_cc_set_reading`, action for an out-of-range value), `cc_equipment` + `cc_equipment_tasks` + `cc_equipment_log` (a calibration entry moves `last_calibrated`, trigger); rules pure in `src/lib/coldchain/core.ts`; actions `actions/coldchain.ts`; pages `/cold-chain/*`; station `coldchain`, nav group `Cold chain` (workspace `/w/cold-chain`: `groupSlug` in nav.ts turns spaces into dashes) |
| Printed-document QR (0119) | each code has a `verify_key` (codes server `_spir_lic.verify_key`, sent with the license, kept in `_spir_license.verify_key`); `src/lib/license/doc-verify.ts` (pure: `signDoc`/`openDoc`/`docValid`, HMAC of the document's facts); `docVerifyUrl` in `device.ts`; `components/print/VerifyQr.tsx` on `DocumentSheet` and `AuthorizationSheet` (nothing when codes are off); public `/verify/[token]` on the codes server |
| Insights & calendar | `/insights` (KPI tiles, 12-month sales columns, top products/labs, receivables by age, expiring kits; charts are `components/charts/Bars.tsx`: `BarList`, `Columns`, `AsTable`, no chart library) · `/calendar` (month grid Saturday-first from pure `src/lib/calendar.ts`: appointments, visits, invoices due, kit expiry, leaves, calibration, guide reviews; `?month=`, `?day=`) |
| Barcode labels | `src/lib/barcode/code128.ts` (pure Code 128 set B → SVG, checked against python-barcode), `/labels` (products, kit batches, serials; copies; printable sheet) |
| Guides & training (0120) | from spir-lab-manager's training station: `kb_guides` (purpose, steps jsonb with warnings, tips, safety, troubleshooting, version bumped by trigger on content change, review dates; pictures/PDFs as `attachments` entity `kb_guide`), `kb_trainees`, `kb_results`; pure `src/lib/guides/core.ts` (form parsing, seeded `buildQuiz`, `score`); jsonb columns are sent as JSON text from actions; station `guides` |
| Main menu & stations | the welcome page is the main menu, signed in or not: opening the program (`/` with no Referer, `open-app.vbs`, manifest `start_url`) and signing in without `next` land there (middleware, `safeNext`). A station card → `/station/<id>` (`src/app/station/[id]/page.tsx`: its sections as tiles); `AppNav` (kept across navigations, so it re-reads the address/cookie on every path change) remembers it in cookie `spir_station`, set in the browser — never in the middleware, which also sees Next's prefetch of every station card — and shows only that station's groups plus «Main menu» (`/welcome`) and «The whole system». `/station/all` is rewritten to `/` (the dashboard, every section); the sidebar clears the cookie there and on `/` |
| Welcome page | `src/app/welcome/page.tsx`: branding, the stations (project colours), data location, contact + version, the activation window. Cards: «the whole system» first (on an activated computer it opens with the activation code as the built-in admin — `codeLoginAction`, `codeOpensThisComputer`, fingerprint `_spir_license.code_hash` (0116); `/login?with=code`, `CodeLoginForm`), then the stations, 3 per row; provider phone `PROVIDER_PHONE` (`license/provider.ts`) at the foot. Comes before sign-in: the middleware sends a signed-out page visit to `/welcome?next=<page>` (API calls and posts still go to `/login`), a station or «the whole system» leads to `/login?next=…`, and signing out returns here |
| Second copy of the records | `src/lib/backup/copies.ts` (pure: a copy elsewhere within 3 days — upstream sync, an office computer's sync, an automatic backup to an outside folder), `copies-server.ts`; bell notice (admins) in `layout.tsx`, «copy» step in the setup checklist |
| First steps of a new company | `src/lib/setup-checklist.ts`, `components/dashboard/SetupChecklist.tsx` (home page, admins) |
| Sync status / health | `components/offline/DbSyncStatus.tsx` (header chip), `/monitoring/sync`, `components/monitoring/DatabaseSyncPanel.tsx` |
| Offline (browser) | `public/offline-sw.js`: pages network-first with a per-user saved copy (header `x-spir-user` from the middleware; `0` = signed out → copies dropped), `/_next/static/` cache-first (content-hashed, so builds never mix), `offline.html` for a page never opened; `/api/ping` + `serverUp` in `OfflineProvider` → `OfflineBanner` and the header chip; `src/lib/offline/outbox.ts` (POS sales / sales orders queued while the server does not answer) |
| Backups | manual: `src/app/api/backup/route.ts`, `components/settings/BackupPanel.tsx`, `actions/backup.ts`; automatic: `src/lib/backup/auto.ts` + `schedule.ts` (pure), `actions/autobackup.ts`, `components/settings/AutoBackupPanel.tsx`, `/api/backup/file`; restore = `restoreLocalDatabase` in `pglite.ts` (validates in memory first, new node id) |
| Audit trail | `fn_audit` trigger → `audit_log`; actor from `src/lib/audit/actor.ts`; `/audit-log`, `/monitoring/changes` |
| Errors → Arabic | `src/lib/db/errors.ts` (`describeDbError`: 23xxx by SQLSTATE + table/constraint, P0001 shown as raised), `form-error.ts`, `rest.ts` `dbError` (turns every 23xxx `message` Arabic), migration 0102 (rewrites `raise exception` texts); on screen: `components/form/SaveError.tsx` (client forms), `ValidatedForm.tsx` (server-action forms and row buttons) |
| Global search (Ctrl K) | `components/desk/Awesomebar.tsx`, `actions/search.ts`, `fn_global_search` |
| Arabic-aware search (0114) | `fn_ar_norm` (SQL) = `foldArabic` (`src/lib/text/arabic.ts`, pure): hamza forms, ة/ه, ى/ي, diacritics, tatweel, Arabic-Indic digits; used by `fn_global_search`, every `.ilike()` in `rest.ts`, `ListFilter`, POS |
| Daily speed-ups | copy a document: `src/lib/copy-docs.ts` + `/<doc>/new?from=<id>`, `components/desk/CopyLink.tsx`; recent picks first: `components/form/RecentOptions.tsx`; list search memory: `components/desk/RememberSearch.tsx` (no `q` in URL → restore; `?q=` → clear); POS barcode Enter; `src/lib/remember.ts` (localStorage, fail-safe) |
| Kit batch hint | `src/lib/kits.ts` (pure, FEFO like `fn_deduct_kit_stock`), `actions/kits-hint.ts`, `components/form/KitHint.tsx` (POS, invoice, order, request lines) |
| Sharing | WhatsApp: `src/lib/whatsapp.ts` (pure, Iraqi numbers), `components/print/WhatsAppButton.tsx` in `DocumentSheet`; other-currency total in `DocumentSheet`; Excel: `src/lib/xlsx.ts` (pure zip+XML writer), button in `ExportCsvButton.tsx` |
| Generic CRUD forms | `src/app/actions/crud.ts`, `components/desk/*` (ListShell, FormShell, Pager…), `components/form/*` |
| Customer portal | `/portal`, `actions/portal.ts`, `createPortalClient()` |
| Instructions (تعليمات) | `src/app/help/page.tsx`, `components/help/topics.tsx` (content), `parts.tsx` |
| Installer (Windows) | `install-windows.cmd` → `scripts/windows/install.ps1` (PS 5.1, UTF-8 BOM, CRLF), `run-server.cmd`, `run-hidden.vbs`, `open-app.vbs` (UTF-16); Linux: `scripts/service/install-linux.sh` |
| Updates | releases: `.github/workflows/release.yml` (after CI passes on main: tag `build-N`, asset `spir-margin.zip` with `version.json`); app: `src/lib/update/release.ts` (pure), `updates.ts` (check every 6 h, `startUpdate`, `updateTick`), `actions/updates.ts`, `components/settings/UpdatesPanel.tsx`, `/api/update/status`, bell notice in `layout.tsx`; Windows: `scripts/windows/update.ps1` (stage in `updates/stage-N`, build, stop, rename-swap, health check, rollback) + `update-windows.cmd`; web: Vercel deploys main |
| Workspace pages per group | `src/app/w/[slug]` |

## Pages (route → server-action files in `src/app/actions/`)

- **Home** (الرئيسية): `/` Dashboard
- **Shortcuts** (اختصارات): `/sale-requests` Sales requests [currency, kits-hint, sale_request]; `/authorizations` Transport authorisations [authorization]
- **CRM** (إدارة العملاء): `/leads` Leads [crm]; `/opportunities` Opportunities [opportunity]; `/appointments` Appointments [appointment]; `/contracts` Contracts [contract]
- **Selling** (المبيعات): `/pos` Point of Sale [kits-hint, monitoring, pos, selling]; `/labs` Labs [crud]; `/quotations` Quotations [currency, quotation]; `/sales-orders` Sales Orders [currency, kits-hint, monitoring, pos, selling]; `/sales-invoices` Sales Invoices [attachments, currency, kits-hint, sales_invoice]; `/sales-returns` Sales Returns [sales_return]; `/blanket-orders` Blanket Orders [blanket_order]; `/credit-limits` Credit Limits [credit]; `/pricing-rules` Pricing Rules [pricing_rule]
- **Buying** (المشتريات): `/companies` Suppliers [crud]; `/reorder` Reorder [reorder]; `/rfqs` RFQs [rfq]; `/purchase-orders` Purchase Orders [attachments, currency, purchase_order]; `/purchase-receipts` Purchase Receipts [purchase_receipt]; `/purchases` Purchases [purchasing]; `/landed-costs` Landed Costs [landed_cost]
- **Stock** (المخزون): `/products` Products [crud]; `/product-bundles` Bundles [product_bundle]; `/kits` Kits [crud]; `/serials` Serials [serials]; `/warehouses` Warehouses [crud]; `/stock-entries` Stock Entries [stock_entry]; `/pick-lists` Pick Lists [pick_list]; `/delivery-trips` Delivery Trips [delivery_trip]; `/stock-balance` Stock Balance; `/prices` Prices [pricing]; `/labels` Barcode labels
- **Manufacturing** (التصنيع): `/boms` BOMs [manufacturing]; `/work-orders` Work Orders [manufacturing]; `/quality-inspections` Quality [quality]
- **Assets** (الأصول): `/devices` Devices [crud]; `/asset-movements` Movements [asset_movement]; `/installation-notes` Installations [installation]; `/asset-repairs` Repairs [asset_repair]
- **Maintenance** (الصيانة): `/maintenance-board` Field Service Board [maintenance]; `/maintenance-forecast` Maintenance Forecast; `/maintenance-visits` Visits [maintenance]; `/maintenance-schedules` PM Schedules [maintenance_schedule]; `/maintenance-teams` Teams [maintenance_team]
- **Support** (الدعم): `/issues` Issues [attachments, support]; `/warranty` Warranty [support]
- **Accounting** (المحاسبة): `/payment-requests` Payment Requests [payment_request]; `/amc-billing` AMC Billing [amc]; `/banking` Banking [banking]; `/accounts` Accounts [accounts]; `/currency` Currency [currency]
- **Reports** (التقارير): `/reports` All Reports; `/reports/receivables` Receivables Aging; `/reports/profitability` Profitability; `/stock-balance` Stock Balance; `/insights` Insights; `/calendar` Calendar
- **Tools** (الأدوات): `/tools/calculator` Calculator; `/tools/profit` Profit Calculator [currency]; `/tools/converter` Currency Converter [currency]
- **HR** (الكادر والدوام): `/hr/attendance` Attendance [hr]; `/hr/roster` Roster [hr]; `/hr/employees` Employees [hr]; `/hr/leaves` Leaves [hr]; `/hr/advances` Advances [hr]; `/hr/payroll` Payroll (printable); `/hr/shifts` Shifts & rules [hr]
- **Cold chain** (التبريد والمعايرة): `/cold-chain/temperatures` Temperatures [coldchain] (+ `/[unit]?month=` printable month sheet); `/cold-chain/units` Fridges & stores [coldchain]; `/cold-chain/equipment` Instruments & calibration [coldchain] (+ `/[id]` tasks and log)
- **Guides** (الأدلة والتدريب): `/guides` Guides [guides] (+ `/new`, `/[id]` printable SOP with attachments, `/[id]/edit`); `/guides/quiz` Quiz [guides]; `/guides/trainees` Trainees [guides]
- **Monitoring** (المراقبة): `/monitoring/errors` Error Monitor [monitoring]; `/monitoring/changes` Change & Deletion Log; `/monitoring/sync` Sync Health [monitoring, pos, selling, sync]
- **Setup** (الإعداد): `/masters` Masters [masters]; `/users` Users [users]; `/settings` Settings [autobackup, backup, branding, builtin, settings, updates]; `/audit-log` Audit Log; `/sync` Sync [links, peer, remote, sync]; `/help` Instructions

Reached from another page, not the menu (parent in brackets):
`/journal-entries` [journal] and `/taxes` [tax] and `/cost-centers` (read only) — from `/accounts`;
`/material-requests` [material], `/supplier-quotations` [supplier_quotation], `/payment-terms` [purchasing] — from `/purchases`;
`/delivery-notes` [delivery] — from `/delivery-trips`, `/pick-lists`, `/kits`; `/stock-reconciliation` [stock] — from `/stock-entries`, `/kits`;
`/sales-team` (read only) — from `/opportunities`; `/sales/new` [crud] — from the dashboard;
`/reports/purchases`, `/reports/sales-by-lab`, `/reports/sales-by-product` — from `/reports`.

Also outside the menu: `/verify/[token]` (public check of a printed document's QR), `/login` [auth], `/welcome` [license] (the main menu), `/station/<id>` (a station's home; `/station/all` = dashboard), `/licenses` (the code manager: public, its own owner sign-in, bare), `/account` [auth], `/portal` [auth, portal], `/w/<group>`, and every
`/<list>/new`, `/<list>/[id]`, and `/<doc>/[id]/print` (quotations, sales-orders, sales-invoices,
purchase-orders, sale-requests through `components/print/DocumentSheet.tsx`; authorizations through `AuthorizationSheet.tsx`).

Route handlers (no page): `/api/backup` (download a backup), `/api/backup/file` (an automatic backup by name),
`/api/attachments/[id]`, `/api/update/status`, `/login/expired`, and CSV exports `/<list>/export` for
sales-orders, sales-invoices, sales-returns, quotations, purchases, journal-entries, delivery-notes, contracts,
serials, devices.

Dead code: none. The template's unused files (most of `components/ui/*`, `LanguageSwitcher`, five `lib`
helpers incl. a browser Supabase client) and 19 packages only they or nothing used were deleted after the
owner approved. Check again after a big change: walk imports from every page/route/layout/middleware/
instrumentation and the tests; a file nothing reaches, and a dependency nothing imports, goes.

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
  0111 sync renames · 0112 auto update · 0113 remote access · 0114 Arabic search · 0115 device license · 0116 code sign-in · 0117 staff & shifts · 0118 cold chain · 0119 document verify key · 0120 guides & training. Full list with titles in `README.md`.

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
- `.ps1` must stay UTF-8 **with BOM** + CRLF; `.vbs` with Arabic must be UTF-16 (`tests/windows-installer.test.mjs`).
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
- An update must never move `.pglite-data`, `.env.local`, `backups`, `logs` or `updates` (`$Keep` in
  `update.ps1`); the build in the stage folder writes its own `.env.local` and `.pglite-data` — never swap them in.

## Tests

- Unit (`tests/*.test.mjs`): PGlite + real migrations (`tests/helpers.mjs`:
  `bootWithMigrations`, `bootWithSchemaFile`, `loadSeed`, `importTs` to run a
  self-contained `src/**/*.ts` file as is — used for `sync/core.ts`, `code.ts`,
  `seal.ts`, `backup/schedule.ts`).
- Browser (`tests/browser/*.mjs`, harness `harness.mjs`): `crawl.mjs` visits every
  route in `routes.txt` (Latin text / Arabic-Indic digits / console errors); `record-pages.mjs`
  (runs last) opens the first record of every list and its print page with the same checks;
  `e2e-action-errors.mjs` checks refused buttons say why; `e2e-license.mjs` runs a codes server and two
  computers (owner sign-in, a code with one seat, wrong/right code, closed station, seats, stop, message, freed seat);
  `e2e-lan-sync.mjs` starts two extra servers (:3398, :3397) and links them through
  the UI; `e2e-builtin.mjs` restores 123 via the reset file at the end.

## Docs

`docs/INSTALL.md` (Windows/Linux install, Arabic) · `docs/WINDOWS-TRIAL.md` (real-machine checklist) · `docs/HOSTED-SETUP.md` (Supabase +
Vercel demo) · `docs/DEPLOYMENT.md` · `supabase/migrations/README.md` (migration rules) ·
`tests/browser/README.md`.
