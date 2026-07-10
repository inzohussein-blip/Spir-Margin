# MedDevice — Medical Device & Lab Management

A lightweight web app for **selling medical devices, tracking their location in
labs, and managing spare parts and reagent kits** — re-imagined from
[ERPNext](https://github.com/frappe/erpnext) without the weight of a full ERP.

- **Framework:** Next.js 14 (App Router) + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel

---

## Why this exists

ERPNext models these concepts across heavy DocTypes (Asset, Warehouse, Item,
Batch, Stock Entry, Sales Invoice…). This project keeps the **domain model**
those DocTypes encode but re-expresses it as a handful of focused Postgres
tables and a small Next.js UI.

| ERPNext concept            | This app        |
| -------------------------- | --------------- |
| Company / Supplier         | `companies`     |
| Location (asset placement) | `labs`          |
| Warehouse                  | `warehouses`    |
| Item                       | `products`      |
| Asset                      | `devices`       |
| Asset Maintenance          | `maintenance_logs` |
| Batch                      | `kit_batches`   |
| Stock Entry / Ledger       | `stock_movements` |
| Sales Invoice (line)       | `sales`         |

---

## Roadmap (as built)

### المرحلة الأولى — Schema Design
SQL migrations under [`supabase/migrations`](./supabase/migrations):

1. `0001_core_entities.sql` — companies, labs, warehouses, products
2. `0002_devices_batches.sql` — devices, maintenance logs, kit batches
3. `0003_movements_sales.sql` — withdrawals (stock movements) & sales
4. `0004_views_functions.sql` — dashboard views + business-logic functions
5. `0005_rls.sql` — Row Level Security

### المرحلة الثانية — UI (Next.js)
A simple **Dashboard** (`src/app/page.tsx`) showing:

- **Total profit** (`v_profit_summary`)
- **Active labs** (`v_active_labs`)
- **Maintenance alerts** for devices (`v_maintenance_alerts`)
- **Kits near expiry** in warehouses (`v_expiring_kits`)

Plus list pages for Labs, Devices and Kits.

### المرحلة الثالثة — Business Logic (Server Actions)
[`src/app/actions/business.ts`](./src/app/actions/business.ts):

- `recordSale` / `getKitMargin` — **profit = (sell − buy) × qty**, i.e. the
  difference between the price paid to the parent company and the price
  charged to the lab.
- `recordWithdrawal` — logs a lab pulling kits; a DB trigger decrements batch
  stock and stamps the lab active.
- `refreshLabStatuses` — marks labs **active / inactive** based on withdrawal
  activity (delegates to `fn_refresh_lab_status`).

---

## Banking module (ported from Frappe Banking)

A bank-reconciliation module lives under `/banking`:

- **Bank accounts**, **payment entries**, and imported **bank transactions**
- **Match & Reconcile** screen — allocate payments to statement lines
  (`fn_reconcile_transaction` / `fn_unreconcile_transaction`)
- **Matching rules** engine (`fn_apply_rules`) to auto-classify lines by
  description / amount
- **CSV statement import** with client-side column mapping

Schema: `supabase/migrations/0007_banking.sql`, `0008_banking_logic.sql`,
`0009_banking_rls.sql`.

## Getting started

```bash
# 1. Install deps
npm install

# 2. Configure Supabase
cp .env.example .env.local   # fill in your project URL + anon key

# 3. Apply the schema (Supabase CLI, or paste each file in the SQL editor)
supabase db push             # or: run migrations 0001-0005 in order
psql "$DATABASE_URL" -f supabase/seed.sql   # optional demo data

# 4. Run
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

1. Import the repository in Vercel. The Next.js app is at the **repository
   root**, so no Root Directory setting is required — Vercel auto-detects it.
2. Framework Preset: **Next.js**.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and
   `SUPABASE_SERVICE_ROLE_KEY` for privileged actions) as project env vars.

---

## Project structure

```
.                         # ← Next.js app lives at the repo root
├── supabase/
│   ├── migrations/        # SQL schema (المرحلة الأولى)
│   └── seed.sql           # demo data
├── src/
│   ├── app/
│   │   ├── page.tsx       # dashboard (المرحلة الثانية)
│   │   ├── labs/ devices/ kits/ sales/
│   │   └── actions/       # business.ts + crud.ts (المرحلة الثالثة)
│   ├── components/         # dashboard/ + form/
│   └── lib/
│       ├── supabase/      # server & browser clients
│       ├── queries.ts     # form lookup helpers
│       └── types.ts
└── erpnext-reference/     # original ERPNext source, kept for reference only
                           #   (excluded from the build via tsconfig + .eslintignore)
```

> `erpnext-reference/` is **not** part of the Next.js build. It is the upstream
> [ERPNext](https://github.com/frappe/erpnext) code, retained so you can consult
> its data model while developing.
