-- Spir-Margin — combined schema (all 70 migrations + seed). Run ONCE on an EMPTY DB.
-- Default login: admin@spir.local / admin1234 — change after first sign-in.
create extension if not exists pgcrypto;
do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;

-- ===== migration: 0001_core_entities.sql =====
-- =====================================================================
-- Migration 0001 : Core entities
-- Re-design of ERPNext's Company / Warehouse / Item structures for a
-- lightweight medical-device sales & lab-tracking app on Supabase.
--
-- ERPNext mapping:
--   Company / Supplier            -> companies
--   Location (assets)             -> labs
--   Warehouse (stock)             -> warehouses
--   Item (stock)                  -> products
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
    create type company_role as enum ('parent', 'supplier', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
    -- product_type mirrors ERPNext's is_fixed_asset / stock item split
    create type product_type as enum ('device', 'spare_part', 'kit');
exception when duplicate_object then null; end $$;

do $$ begin
    create type lab_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- companies  (parent manufacturer we buy from, and lab customers)
-- ---------------------------------------------------------------------
create table if not exists companies (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    role         company_role not null default 'supplier',
    email        text,
    phone        text,
    country      text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- labs  (ERPNext "Location" for assets: where devices physically live)
-- ---------------------------------------------------------------------
create table if not exists labs (
    id             uuid primary key default gen_random_uuid(),
    code           text unique not null,
    name           text not null,
    status         lab_status not null default 'active',
    -- geo, mirrors erpnext Location latitude/longitude
    latitude       double precision,
    longitude      double precision,
    address        text,
    city           text,
    contact_name   text,
    phone          text,
    email          text,
    -- last time the lab pulled kits; drives active/inactive automation
    last_activity_at timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- warehouses  (ERPNext "Warehouse": our own stores holding stock)
-- ---------------------------------------------------------------------
create table if not exists warehouses (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    is_disabled  boolean not null default false,
    city         text,
    address      text,
    created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- products  (ERPNext "Item": devices, spare parts and kits/reagents)
-- ---------------------------------------------------------------------
create table if not exists products (
    id             uuid primary key default gen_random_uuid(),
    item_code      text unique not null,
    name           text not null,
    product_type   product_type not null,
    brand          text,
    uom            text not null default 'Nos',      -- unit of measure
    supplier_id    uuid references companies(id) on delete set null,
    -- ERPNext Item.shelf_life_in_days -> used for expiry defaulting on kits
    shelf_life_in_days int,
    -- default purchase price from the parent company (buying rate)
    default_buy_price  numeric(14,2) not null default 0,
    -- default selling price to labs (standard_rate in ERPNext)
    default_sell_price numeric(14,2) not null default 0,
    description    text,
    is_disabled    boolean not null default false,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_products_type on products(product_type);
create index if not exists idx_products_supplier on products(supplier_id);

-- ===== migration: 0002_devices_batches.sql =====
-- =====================================================================
-- Migration 0002 : Devices & kit batches
--
-- ERPNext mapping:
--   Asset              -> devices          (serialised medical devices)
--   Asset Maintenance  -> maintenance_logs
--   Batch              -> kit_batches      (reagent / consumable kits)
-- =====================================================================

do $$ begin
    -- ERPNext Asset.status, trimmed to what a device tracker needs
    create type device_status as enum (
        'in_stock',        -- in our warehouse, not yet placed
        'installed',       -- installed and operating in a lab
        'in_maintenance',
        'out_of_order',
        'retired'
    );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- devices  (ERPNext "Asset": each physical machine we track)
-- ---------------------------------------------------------------------
create table if not exists devices (
    id                uuid primary key default gen_random_uuid(),
    asset_code        text unique not null,          -- ERPNext naming_series ACC-ASS-
    product_id        uuid not null references products(id) on delete restrict,
    serial_no         text,
    status            device_status not null default 'in_stock',
    -- current physical location; null while sitting in a warehouse
    lab_id            uuid references labs(id) on delete set null,
    warehouse_id      uuid references warehouses(id) on delete set null,
    custodian_name    text,
    purchase_date     date,
    purchase_price    numeric(14,2) not null default 0,
    -- maintenance planning (ERPNext maintenance_required / next date)
    maintenance_required boolean not null default false,
    next_maintenance_date date,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_devices_lab on devices(lab_id);
create index if not exists idx_devices_status on devices(status);
create index if not exists idx_devices_next_maint on devices(next_maintenance_date);

-- ---------------------------------------------------------------------
-- maintenance_logs  (ERPNext "Asset Maintenance" + task rows)
-- ---------------------------------------------------------------------
create table if not exists maintenance_logs (
    id            uuid primary key default gen_random_uuid(),
    device_id     uuid not null references devices(id) on delete cascade,
    performed_on  date not null default current_date,
    performed_by  text,
    description   text,
    cost          numeric(14,2) not null default 0,
    next_due_date date,
    created_at    timestamptz not null default now()
);

create index if not exists idx_maint_device on maintenance_logs(device_id);

-- ---------------------------------------------------------------------
-- kit_batches  (ERPNext "Batch": reagent kits with expiry & pricing)
-- ---------------------------------------------------------------------
create table if not exists kit_batches (
    id                uuid primary key default gen_random_uuid(),
    batch_no          text not null,
    product_id        uuid not null references products(id) on delete restrict,
    warehouse_id      uuid references warehouses(id) on delete set null,
    supplier_id       uuid references companies(id) on delete set null,
    manufacturing_date date,
    expiry_date       date,                         -- ERPNext Batch.expiry_date
    qty_received      numeric(14,2) not null default 0,
    qty_available     numeric(14,2) not null default 0,
    -- price we paid the parent company for this batch (per unit)
    buy_price         numeric(14,2) not null default 0,
    -- price we sell to the lab (per unit)
    sell_price        numeric(14,2) not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    unique (batch_no, product_id)
);

create index if not exists idx_batches_product on kit_batches(product_id);
create index if not exists idx_batches_expiry on kit_batches(expiry_date);
create index if not exists idx_batches_available on kit_batches(qty_available);

-- ===== migration: 0003_movements_sales.sql =====
-- =====================================================================
-- Migration 0003 : Stock movements (withdrawals) & sales
--
-- ERPNext mapping:
--   Stock Entry / Stock Ledger Entry -> stock_movements  (السحبات)
--   Sales Invoice / Item             -> sales            (profit source)
-- =====================================================================

do $$ begin
    create type movement_type as enum ('withdrawal', 'return', 'transfer_in');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- stock_movements  (a lab pulling kits = "withdrawal" / سحبة)
-- These rows drive both profit recognition and lab active/inactive state
-- ---------------------------------------------------------------------
create table if not exists stock_movements (
    id            uuid primary key default gen_random_uuid(),
    kit_batch_id  uuid not null references kit_batches(id) on delete restrict,
    lab_id        uuid not null references labs(id) on delete restrict,
    type          movement_type not null default 'withdrawal',
    qty           numeric(14,2) not null check (qty > 0),
    -- prices snapshotted at movement time so historical profit is stable
    buy_price     numeric(14,2) not null default 0,
    sell_price    numeric(14,2) not null default 0,
    moved_at      timestamptz not null default now(),
    note          text,
    created_at    timestamptz not null default now()
);

create index if not exists idx_moves_lab on stock_movements(lab_id);
create index if not exists idx_moves_batch on stock_movements(kit_batch_id);
create index if not exists idx_moves_date on stock_movements(moved_at);

-- ---------------------------------------------------------------------
-- sales  (ERPNext Sales Invoice line: what a lab actually bought)
-- Kept simple: one row per sale of a product to a lab.
-- ---------------------------------------------------------------------
create table if not exists sales (
    id            uuid primary key default gen_random_uuid(),
    lab_id        uuid not null references labs(id) on delete restrict,
    product_id    uuid not null references products(id) on delete restrict,
    kit_batch_id  uuid references kit_batches(id) on delete set null,
    qty           numeric(14,2) not null check (qty > 0),
    buy_price     numeric(14,2) not null default 0,   -- cost from parent company
    sell_price    numeric(14,2) not null default 0,   -- charged to the lab
    sold_at       timestamptz not null default now(),
    created_at    timestamptz not null default now()
);

create index if not exists idx_sales_lab on sales(lab_id);
create index if not exists idx_sales_date on sales(sold_at);

-- generated profit column for convenience
alter table sales
    add column if not exists profit numeric(14,2)
    generated always as ((sell_price - buy_price) * qty) stored;

-- ===== migration: 0004_views_functions.sql =====
-- =====================================================================
-- Migration 0004 : Dashboard views & business-logic functions
--
-- Implements المرحلة الثالثة (Business Logic):
--   * profit = (sell_price - buy_price) per kit / sale
--   * lab active/inactive automation based on withdrawal movement
-- Exposed as SQL views + RPC functions callable from Next.js server actions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- View: total profit (from sales) — feeds the dashboard KPI
-- ---------------------------------------------------------------------
create or replace view v_profit_summary as
select
    coalesce(sum(profit), 0)                       as total_profit,
    coalesce(sum(sell_price * qty), 0)             as total_revenue,
    coalesce(sum(buy_price * qty), 0)              as total_cost,
    count(*)                                       as sales_count
from sales;

-- Profit per lab (useful for lab detail pages)
create or replace view v_profit_by_lab as
select
    l.id            as lab_id,
    l.name          as lab_name,
    coalesce(sum(s.profit), 0)          as total_profit,
    coalesce(sum(s.sell_price * s.qty), 0) as total_revenue,
    count(s.id)     as sales_count
from labs l
left join sales s on s.lab_id = l.id
group by l.id, l.name;

-- ---------------------------------------------------------------------
-- View: active labs (with basic stats)
-- ---------------------------------------------------------------------
create or replace view v_active_labs as
select
    l.*,
    (select count(*) from devices d where d.lab_id = l.id) as device_count,
    (select coalesce(sum(m.qty),0) from stock_movements m
        where m.lab_id = l.id and m.type = 'withdrawal')  as total_withdrawn
from labs l
where l.status = 'active';

-- ---------------------------------------------------------------------
-- View: devices needing maintenance (ERPNext maintenance alert)
-- ---------------------------------------------------------------------
create or replace view v_maintenance_alerts as
select
    d.id,
    d.asset_code,
    d.serial_no,
    p.name              as product_name,
    l.name              as lab_name,
    d.status,
    d.next_maintenance_date,
    (d.next_maintenance_date - current_date) as days_until_due
from devices d
join products p on p.id = d.product_id
left join labs l on l.id = d.lab_id
where d.status = 'out_of_order'
   or d.status = 'in_maintenance'
   or (d.maintenance_required = true
       and d.next_maintenance_date is not null
       and d.next_maintenance_date <= current_date + interval '30 days')
order by d.next_maintenance_date nulls last;

-- ---------------------------------------------------------------------
-- View: kits near expiry (within 90 days) with stock on hand
-- ---------------------------------------------------------------------
create or replace view v_expiring_kits as
select
    b.id,
    b.batch_no,
    p.name          as product_name,
    w.name          as warehouse_name,
    b.expiry_date,
    b.qty_available,
    (b.expiry_date - current_date) as days_until_expiry
from kit_batches b
join products p on p.id = b.product_id
left join warehouses w on w.id = b.warehouse_id
where b.qty_available > 0
  and b.expiry_date is not null
  and b.expiry_date <= current_date + interval '90 days'
order by b.expiry_date asc;

-- =====================================================================
-- Business-logic functions (callable as Supabase RPC)
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_kit_margin: profit margin for a single kit batch
--   returns unit margin and total potential margin on available qty
-- ---------------------------------------------------------------------
create or replace function fn_kit_margin(p_batch_id uuid)
returns table (
    batch_no       text,
    unit_margin    numeric,
    margin_pct     numeric,
    potential_margin numeric
)
language sql
stable
as $$
    select
        b.batch_no,
        (b.sell_price - b.buy_price)                         as unit_margin,
        case when b.buy_price > 0
             then round(((b.sell_price - b.buy_price) / b.buy_price) * 100, 2)
             else null end                                   as margin_pct,
        (b.sell_price - b.buy_price) * b.qty_available        as potential_margin
    from kit_batches b
    where b.id = p_batch_id;
$$;

-- ---------------------------------------------------------------------
-- fn_refresh_lab_status: set a lab active/inactive based on withdrawal
--   activity. A lab with no withdrawal in the last `p_days` days
--   (default 60) is marked inactive; otherwise active.
--   Also refreshes labs.last_activity_at.
-- ---------------------------------------------------------------------
create or replace function fn_refresh_lab_status(
    p_lab_id uuid default null,
    p_days   int  default 60
)
returns int
language plpgsql
as $$
declare
    v_updated int;
begin
    with last_move as (
        select lab_id, max(moved_at) as last_at
        from stock_movements
        where type = 'withdrawal'
        group by lab_id
    )
    update labs l
    set last_activity_at = lm.last_at,
        status = case
            when lm.last_at is not null
                 and lm.last_at >= now() - (p_days || ' days')::interval
            then 'active'::lab_status
            else 'inactive'::lab_status
        end,
        updated_at = now()
    from (
        select l2.id, lm2.last_at
        from labs l2
        left join last_move lm2 on lm2.lab_id = l2.id
    ) lm
    where l.id = lm.id
      and (p_lab_id is null or l.id = p_lab_id);

    get diagnostics v_updated = row_count;
    return v_updated;
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger: whenever a withdrawal is recorded, decrement batch stock,
-- stamp the lab's last activity, and (re)activate the lab.
-- ---------------------------------------------------------------------
create or replace function trg_apply_withdrawal()
returns trigger
language plpgsql
as $$
begin
    if new.type = 'withdrawal' then
        update kit_batches
           set qty_available = qty_available - new.qty,
               updated_at = now()
         where id = new.kit_batch_id;

        update labs
           set last_activity_at = new.moved_at,
               status = 'active',
               updated_at = now()
         where id = new.lab_id;
    elsif new.type in ('return', 'transfer_in') then
        update kit_batches
           set qty_available = qty_available + new.qty,
               updated_at = now()
         where id = new.kit_batch_id;
    end if;
    return new;
end;
$$;

drop trigger if exists t_apply_withdrawal on stock_movements;
create trigger t_apply_withdrawal
    after insert on stock_movements
    for each row execute function trg_apply_withdrawal();

-- ===== migration: 0005_rls.sql =====
-- =====================================================================
-- Migration 0005 : Row Level Security
-- Enable RLS on all tables. Authenticated users get full access
-- (single-tenant internal tool). Tighten per-role later as needed.
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array[
        'companies','labs','warehouses','products',
        'devices','maintenance_logs','kit_batches',
        'stock_movements','sales'
    ]
    loop
        execute format('alter table %I enable row level security;', t);

        execute format($f$
            drop policy if exists "authenticated_all" on %I;
        $f$, t);

        execute format($f$
            create policy "authenticated_all" on %I
                for all
                to authenticated
                using (true)
                with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0006_masters.sql =====
-- =====================================================================
-- Migration 0006 : Master-data fidelity
-- Extends companies / products / warehouses with a few fields ported
-- from their ERPNext DocTypes (Supplier, Item, Warehouse) so the master
-- screens carry the same core attributes.
-- =====================================================================

-- companies  <- ERPNext "Supplier"
do $$ begin
    create type supplier_type as enum ('company', 'individual', 'partnership');
exception when duplicate_object then null; end $$;

alter table companies
    add column if not exists tax_id       text,
    add column if not exists supplier_type supplier_type not null default 'company',
    add column if not exists is_disabled  boolean not null default false;

-- products  <- ERPNext "Item"
alter table products
    add column if not exists item_group    text,
    -- ERPNext Item reorder level -> low-stock alerting for kits/spares
    add column if not exists reorder_level numeric(14,2) not null default 0;

create index if not exists idx_products_group on products(item_group);

-- warehouses  <- ERPNext "Warehouse"
alter table warehouses
    add column if not exists warehouse_type text,   -- e.g. Stock / Cold / Transit
    add column if not exists phone          text;

-- ===== migration: 0007_banking.sql =====
-- =====================================================================
-- Migration 0007 : Banking & Bank Reconciliation
--
-- Ported from the Frappe "Banking" app DocTypes (BankAccount,
-- BankTransaction, PaymentEntry, BankTransactionPayments,
-- BankTransactionRule + conditions, BankStatementImportLog) onto Supabase.
--
-- Party links reuse existing entities: a party is either a company
-- (supplier / parent) or a lab (customer).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin create type party_type as enum ('company','lab'); exception when duplicate_object then null; end $$;
do $$ begin create type bank_txn_status as enum ('pending','settled','unreconciled','reconciled','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_type as enum ('receive','pay','internal_transfer'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_txn_type as enum ('any','withdrawal','deposit'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_classify as enum ('bank_entry','payment_entry','transfer'); exception when duplicate_object then null; end $$;
do $$ begin create type reconciliation_type as enum ('matched','voucher_created'); exception when duplicate_object then null; end $$;
do $$ begin create type import_status as enum ('not_started','completed'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- bank_accounts  <- BankAccount
-- ---------------------------------------------------------------------
create table if not exists bank_accounts (
    id                 uuid primary key default gen_random_uuid(),
    account_name       text not null,
    bank               text not null,
    account_type       text,
    account_subtype    text,
    account_no         text,
    iban               text,
    branch_code        text,
    currency           text not null default 'USD',
    is_company_account boolean not null default true,
    is_default         boolean not null default false,
    is_credit_card     boolean not null default false,
    -- when the account belongs to an external party rather than the company
    party_type         party_type,
    party_company_id   uuid references companies(id) on delete set null,
    party_lab_id       uuid references labs(id) on delete set null,
    disabled           boolean not null default false,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- payment_entries  <- PaymentEntry (simplified for reconciliation)
-- ---------------------------------------------------------------------
create table if not exists payment_entries (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,                       -- e.g. ACC-PAY-2026-0001
    payment_type     payment_type not null,
    posting_date     date not null default current_date,
    -- party (who we paid / received from)
    party_type       party_type,
    party_company_id uuid references companies(id) on delete set null,
    party_lab_id     uuid references labs(id) on delete set null,
    party_name       text,
    mode_of_payment  text,
    bank_account_id  uuid references bank_accounts(id) on delete set null,
    paid_amount      numeric(14,2) not null default 0,
    received_amount  numeric(14,2) not null default 0,
    reference_no     text,
    reference_date   date,
    clearance_date   date,
    -- 'unreconciled' until a bank transaction is matched to it
    is_reconciled    boolean not null default false,
    remarks          text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists idx_pe_bank on payment_entries(bank_account_id);
create index if not exists idx_pe_reconciled on payment_entries(is_reconciled);

-- ---------------------------------------------------------------------
-- bank_transactions  <- BankTransaction
-- deposit  = money in, withdrawal = money out (mutually exclusive)
-- ---------------------------------------------------------------------
create table if not exists bank_transactions (
    id                 uuid primary key default gen_random_uuid(),
    naming_series      text,                     -- ACC-BTN-...
    date               date not null default current_date,
    bank_account_id    uuid not null references bank_accounts(id) on delete restrict,
    status             bank_txn_status not null default 'unreconciled',
    deposit            numeric(14,2) not null default 0,
    withdrawal         numeric(14,2) not null default 0,
    currency           text not null default 'USD',
    description        text,
    reference_number   text,
    transaction_id     text,                     -- bank's own id (dedupe key)
    transaction_type   text,
    -- allocation bookkeeping (kept in sync by trigger below)
    allocated_amount   numeric(14,2) not null default 0,
    unallocated_amount numeric(14,2) not null default 0,
    party_type         party_type,
    party_company_id   uuid references companies(id) on delete set null,
    party_lab_id       uuid references labs(id) on delete set null,
    matched_rule_id    uuid,
    import_log_id      uuid,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    unique (bank_account_id, transaction_id)
);

create index if not exists idx_bt_account on bank_transactions(bank_account_id);
create index if not exists idx_bt_status on bank_transactions(status);
create index if not exists idx_bt_date on bank_transactions(date);

-- ---------------------------------------------------------------------
-- bank_transaction_payments  <- BankTransactionPayments (allocation link)
-- ---------------------------------------------------------------------
create table if not exists bank_transaction_payments (
    id                  uuid primary key default gen_random_uuid(),
    bank_transaction_id uuid not null references bank_transactions(id) on delete cascade,
    payment_entry_id    uuid references payment_entries(id) on delete set null,
    allocated_amount    numeric(14,2) not null check (allocated_amount > 0),
    clearance_date      date,
    reconciliation_type reconciliation_type not null default 'matched',
    created_at          timestamptz not null default now(),
    unique (bank_transaction_id, payment_entry_id)
);

create index if not exists idx_btp_txn on bank_transaction_payments(bank_transaction_id);
create index if not exists idx_btp_pe on bank_transaction_payments(payment_entry_id);

-- ---------------------------------------------------------------------
-- bank_transaction_rules  <- BankTransactionRule (+ conditions)
-- ---------------------------------------------------------------------
create table if not exists bank_transaction_rules (
    id               uuid primary key default gen_random_uuid(),
    rule_name        text not null,
    transaction_type rule_txn_type not null default 'any',
    priority         int not null default 1,
    min_amount       numeric(14,2),
    max_amount       numeric(14,2),
    classify_as      rule_classify not null default 'payment_entry',
    party_type       party_type,
    party_company_id uuid references companies(id) on delete set null,
    party_lab_id     uuid references labs(id) on delete set null,
    is_disabled      boolean not null default false,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists bank_rule_conditions (
    id          uuid primary key default gen_random_uuid(),
    rule_id     uuid not null references bank_transaction_rules(id) on delete cascade,
    field       text not null default 'description',   -- description / reference_number
    operator    text not null default 'contains',      -- contains / equals / starts_with
    value       text not null,
    created_at  timestamptz not null default now()
);

create index if not exists idx_rulecond_rule on bank_rule_conditions(rule_id);

-- ---------------------------------------------------------------------
-- bank_statement_import_logs  <- BankStatementImportLog
-- ---------------------------------------------------------------------
create table if not exists bank_statement_import_logs (
    id                        uuid primary key default gen_random_uuid(),
    bank_account_id           uuid not null references bank_accounts(id) on delete cascade,
    file_name                 text,
    status                    import_status not null default 'not_started',
    currency                  text default 'USD',
    number_of_transactions    int not null default 0,
    start_date                date,
    end_date                  date,
    closing_balance           numeric(14,2),
    total_debits              numeric(14,2) not null default 0,
    total_credits             numeric(14,2) not null default 0,
    total_debit_transactions  int not null default 0,
    total_credit_transactions int not null default 0,
    detected_date_format      text,
    detected_amount_format    text,
    column_mapping            jsonb,
    created_at                timestamptz not null default now()
);

create index if not exists idx_import_account on bank_statement_import_logs(bank_account_id);

-- late FKs (declared after the referenced tables exist)
alter table bank_transactions
    drop constraint if exists bt_matched_rule_fk,
    add constraint bt_matched_rule_fk
        foreign key (matched_rule_id) references bank_transaction_rules(id) on delete set null;
alter table bank_transactions
    drop constraint if exists bt_import_log_fk,
    add constraint bt_import_log_fk
        foreign key (import_log_id) references bank_statement_import_logs(id) on delete set null;

-- ===== migration: 0008_banking_logic.sql =====
-- =====================================================================
-- Migration 0008 : Bank reconciliation logic
-- Trigger + RPC functions + views that reproduce the core behaviour of
-- the Frappe Banking "Match & Reconcile" and rule engine.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Keep unallocated_amount consistent on the transaction itself, so a newly
-- imported line starts fully unallocated (= deposit + withdrawal).
-- ---------------------------------------------------------------------
create or replace function trg_init_bank_txn()
returns trigger
language plpgsql
as $$
begin
    new.unallocated_amount :=
        greatest((coalesce(new.deposit,0) + coalesce(new.withdrawal,0))
                 - coalesce(new.allocated_amount,0), 0);
    return new;
end;
$$;

drop trigger if exists t_init_bank_txn on bank_transactions;
create trigger t_init_bank_txn
    before insert or update on bank_transactions
    for each row execute function trg_init_bank_txn();

-- ---------------------------------------------------------------------
-- Keep a bank transaction's allocation totals & status in sync whenever
-- its payment allocations change; flag linked payment entries reconciled.
-- ---------------------------------------------------------------------
create or replace function trg_sync_bank_txn_allocation()
returns trigger
language plpgsql
as $$
declare
    v_txn_id uuid := coalesce(new.bank_transaction_id, old.bank_transaction_id);
    v_amount numeric;
    v_alloc  numeric;
begin
    select (deposit + withdrawal) into v_amount
      from bank_transactions where id = v_txn_id;

    select coalesce(sum(allocated_amount), 0) into v_alloc
      from bank_transaction_payments where bank_transaction_id = v_txn_id;

    update bank_transactions
       set allocated_amount   = v_alloc,
           unallocated_amount  = greatest(v_amount - v_alloc, 0),
           status = case
               when status = 'cancelled' then 'cancelled'::bank_txn_status
               when v_alloc >= v_amount - 0.005 and v_amount > 0 then 'reconciled'::bank_txn_status
               else 'unreconciled'::bank_txn_status
           end,
           updated_at = now()
     where id = v_txn_id;

    -- reflect reconciled state on the payment entry that changed
    if tg_op = 'DELETE' then
        if old.payment_entry_id is not null then
            update payment_entries
               set is_reconciled = exists (
                     select 1 from bank_transaction_payments
                      where payment_entry_id = old.payment_entry_id),
                   updated_at = now()
             where id = old.payment_entry_id;
        end if;
        return old;
    else
        if new.payment_entry_id is not null then
            update payment_entries
               set is_reconciled = true,
                   clearance_date = coalesce(new.clearance_date, current_date),
                   updated_at = now()
             where id = new.payment_entry_id;
        end if;
        return new;
    end if;
end;
$$;

drop trigger if exists t_sync_alloc on bank_transaction_payments;
create trigger t_sync_alloc
    after insert or update or delete on bank_transaction_payments
    for each row execute function trg_sync_bank_txn_allocation();

-- ---------------------------------------------------------------------
-- fn_reconcile_transaction: allocate an existing payment entry to a bank
-- transaction (the "Match" action). Returns the resulting status.
-- ---------------------------------------------------------------------
create or replace function fn_reconcile_transaction(
    p_txn_id     uuid,
    p_payment_id uuid,
    p_amount     numeric default null
)
returns bank_txn_status
language plpgsql
as $$
declare
    v_amount   numeric;
    v_unalloc  numeric;
    v_status   bank_txn_status;
begin
    select unallocated_amount into v_unalloc
      from bank_transactions where id = p_txn_id;

    -- default: allocate the whole remaining transaction amount
    v_amount := coalesce(p_amount, v_unalloc);
    if v_amount <= 0 then
        raise exception 'Nothing left to allocate on this transaction';
    end if;

    insert into bank_transaction_payments
        (bank_transaction_id, payment_entry_id, allocated_amount, reconciliation_type)
    values (p_txn_id, p_payment_id, v_amount, 'matched')
    on conflict (bank_transaction_id, payment_entry_id)
    do update set allocated_amount = bank_transaction_payments.allocated_amount + excluded.allocated_amount;

    select status into v_status from bank_transactions where id = p_txn_id;
    return v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_unreconcile_transaction: remove all allocations from a transaction.
-- ---------------------------------------------------------------------
create or replace function fn_unreconcile_transaction(p_txn_id uuid)
returns void
language sql
as $$
    delete from bank_transaction_payments where bank_transaction_id = p_txn_id;
$$;

-- ---------------------------------------------------------------------
-- fn_apply_rules: evaluate active rules against a transaction and set its
-- party + matched rule. Highest-priority matching rule wins.
-- ---------------------------------------------------------------------
create or replace function fn_apply_rules(p_txn_id uuid)
returns uuid
language plpgsql
as $$
declare
    v_txn   bank_transactions%rowtype;
    v_amt   numeric;
    v_kind  rule_txn_type;
    r       record;
    ok      boolean;
    c       record;
begin
    select * into v_txn from bank_transactions where id = p_txn_id;
    if not found then return null; end if;

    v_amt  := v_txn.deposit + v_txn.withdrawal;
    v_kind := case when v_txn.deposit > 0 then 'deposit' else 'withdrawal' end;

    for r in
        select * from bank_transaction_rules
         where is_disabled = false
           and (transaction_type = 'any' or transaction_type = v_kind)
           and (min_amount is null or v_amt >= min_amount)
           and (max_amount is null or v_amt <= max_amount)
         order by priority asc, created_at asc
    loop
        ok := true;
        for c in select * from bank_rule_conditions where rule_id = r.id loop
            declare v_field text;
            begin
                v_field := case c.field
                    when 'reference_number' then coalesce(v_txn.reference_number,'')
                    else coalesce(v_txn.description,'') end;
                if c.operator = 'equals' then
                    ok := ok and (lower(v_field) = lower(c.value));
                elsif c.operator = 'starts_with' then
                    ok := ok and (lower(v_field) like lower(c.value) || '%');
                else -- contains
                    ok := ok and (position(lower(c.value) in lower(v_field)) > 0);
                end if;
            end;
        end loop;

        if ok then
            update bank_transactions
               set matched_rule_id = r.id,
                   party_type      = r.party_type,
                   party_company_id = r.party_company_id,
                   party_lab_id    = r.party_lab_id,
                   updated_at = now()
             where id = p_txn_id;
            return r.id;
        end if;
    end loop;
    return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Views for the reconciliation dashboard
-- ---------------------------------------------------------------------
create or replace view v_bank_rec_summary as
select
    ba.id   as bank_account_id,
    ba.account_name,
    ba.bank,
    ba.currency,
    coalesce(sum(bt.deposit), 0)                                     as total_deposits,
    coalesce(sum(bt.withdrawal), 0)                                  as total_withdrawals,
    coalesce(sum(case when bt.status <> 'reconciled'
                      then bt.unallocated_amount else 0 end), 0)     as unreconciled_amount,
    count(bt.id) filter (where bt.status <> 'reconciled')            as unreconciled_count,
    count(bt.id) filter (where bt.status = 'reconciled')             as reconciled_count
from bank_accounts ba
left join bank_transactions bt on bt.bank_account_id = ba.id
group by ba.id, ba.account_name, ba.bank, ba.currency;

create or replace view v_unreconciled_transactions as
select
    bt.*,
    ba.account_name,
    ba.bank
from bank_transactions bt
join bank_accounts ba on ba.id = bt.bank_account_id
where bt.status <> 'reconciled' and bt.status <> 'cancelled'
order by bt.date desc;

-- ===== migration: 0009_banking_rls.sql =====
-- =====================================================================
-- Migration 0009 : RLS for banking tables (mirrors 0005)
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array[
        'bank_accounts','payment_entries','bank_transactions',
        'bank_transaction_payments','bank_transaction_rules',
        'bank_rule_conditions','bank_statement_import_logs'
    ]
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0010_purchasing.sql =====
-- =====================================================================
-- Migration 0010 : Purchasing (Buying)
--
-- Ported from ERPNext Purchase Invoice / Purchase Receipt: record buying
-- products from a supplier (parent company). "Receiving" a purchase turns
-- its lines into stock — kit batches for kits, device records for devices.
-- This is the cost side of the profit equation.
-- =====================================================================

do $$ begin
    create type purchase_status as enum ('draft', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- purchase_invoices  <- ERPNext Purchase Invoice (header)
-- ---------------------------------------------------------------------
create table if not exists purchase_invoices (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    supplier_id   uuid references companies(id) on delete set null,
    posting_date  date not null default current_date,
    reference_no  text,                       -- supplier's invoice no.
    status        purchase_status not null default 'draft',
    total_amount  numeric(14,2) not null default 0,
    is_paid       boolean not null default false,
    notes         text,
    received_at   timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_pi_supplier on purchase_invoices(supplier_id);
create index if not exists idx_pi_status on purchase_invoices(status);

-- ---------------------------------------------------------------------
-- purchase_items  <- Purchase Invoice Item (lines)
-- ---------------------------------------------------------------------
create table if not exists purchase_items (
    id                 uuid primary key default gen_random_uuid(),
    purchase_id        uuid not null references purchase_invoices(id) on delete cascade,
    product_id         uuid not null references products(id) on delete restrict,
    qty                numeric(14,2) not null check (qty > 0),
    rate               numeric(14,2) not null default 0,   -- buy price per unit
    amount             numeric(14,2) generated always as (qty * rate) stored,
    -- kit-specific receiving hints
    batch_no           text,
    manufacturing_date date,
    expiry_date        date,
    warehouse_id       uuid references warehouses(id) on delete set null,
    created_at         timestamptz not null default now()
);

create index if not exists idx_puritems_purchase on purchase_items(purchase_id);

-- ---------------------------------------------------------------------
-- Keep the invoice total in sync with its lines
-- ---------------------------------------------------------------------
create or replace function trg_sync_purchase_total()
returns trigger
language plpgsql
as $$
declare
    v_id uuid := coalesce(new.purchase_id, old.purchase_id);
begin
    update purchase_invoices
       set total_amount = coalesce((select sum(amount) from purchase_items where purchase_id = v_id), 0),
           updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end;
$$;

drop trigger if exists t_sync_purchase_total on purchase_items;
create trigger t_sync_purchase_total
    after insert or update or delete on purchase_items
    for each row execute function trg_sync_purchase_total();

-- ---------------------------------------------------------------------
-- fn_receive_purchase: post a purchase into stock.
--   kit    -> create a kit_batch (qty, buy price, expiry)
--   device -> create `qty` device rows (in_stock)
--   spare_part -> recorded only (no stock object in this schema)
-- Idempotent-ish: refuses to receive an already-received purchase.
-- ---------------------------------------------------------------------
create or replace function fn_receive_purchase(p_purchase_id uuid)
returns int
language plpgsql
as $$
declare
    v_status  purchase_status;
    v_supplier uuid;
    it        record;
    i         int;
    v_created int := 0;
    v_sell    numeric;
    v_ptype   product_type;
    v_pname   text;
begin
    select status, supplier_id into v_status, v_supplier
      from purchase_invoices where id = p_purchase_id;
    if not found then raise exception 'Purchase not found'; end if;
    if v_status = 'received' then raise exception 'Purchase already received'; end if;
    if v_status = 'cancelled' then raise exception 'Purchase is cancelled'; end if;

    for it in select * from purchase_items where purchase_id = p_purchase_id loop
        select product_type, default_sell_price, name
          into v_ptype, v_sell, v_pname
          from products where id = it.product_id;

        if v_ptype = 'kit' then
            insert into kit_batches
                (batch_no, product_id, warehouse_id, supplier_id,
                 manufacturing_date, expiry_date, qty_received, qty_available,
                 buy_price, sell_price)
            values
                (coalesce(it.batch_no, 'B-' || upper(substr(md5(random()::text), 1, 6))),
                 it.product_id, it.warehouse_id, v_supplier,
                 it.manufacturing_date, it.expiry_date, it.qty, it.qty,
                 it.rate, coalesce(v_sell, it.rate))
            on conflict (batch_no, product_id) do update
                set qty_received = kit_batches.qty_received + excluded.qty_received,
                    qty_available = kit_batches.qty_available + excluded.qty_available,
                    updated_at = now();
            v_created := v_created + 1;

        elsif v_ptype = 'device' then
            for i in 1 .. floor(it.qty)::int loop
                insert into devices
                    (asset_code, product_id, status, warehouse_id,
                     purchase_date, purchase_price)
                values
                    ('ACC-ASS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
                     it.product_id, 'in_stock', it.warehouse_id,
                     current_date, it.rate);
                v_created := v_created + 1;
            end loop;
        end if;
    end loop;

    update purchase_invoices
       set status = 'received', received_at = now(), updated_at = now()
     where id = p_purchase_id;

    return v_created;
end;
$$;

-- ---------------------------------------------------------------------
-- View: purchase profit context (cost bought per supplier)
-- ---------------------------------------------------------------------
create or replace view v_purchase_summary as
select
    coalesce(sum(total_amount) filter (where status = 'received'), 0) as total_received_cost,
    coalesce(sum(total_amount) filter (where status = 'draft'), 0)    as total_draft_cost,
    count(*) filter (where status = 'received')                       as received_count,
    count(*) filter (where status = 'draft')                          as draft_count
from purchase_invoices;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array['purchase_invoices', 'purchase_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0011_item_prices.sql =====
-- =====================================================================
-- Migration 0011 : Item Price (price lists)
--
-- Ported from ERPNext "Item Price" DocType. Lets a product carry multiple
-- prices — per price list, optionally per lab (customer) or supplier, with
-- a validity window and buying/selling flags. This lets each lab have its
-- own negotiated selling rate instead of a single product default.
-- =====================================================================

create table if not exists item_prices (
    id            uuid primary key default gen_random_uuid(),
    product_id    uuid not null references products(id) on delete cascade,
    price_list    text not null default 'Standard Selling',
    selling       boolean not null default true,
    buying        boolean not null default false,
    -- optional party scoping (ERPNext customer / supplier)
    lab_id        uuid references labs(id) on delete set null,
    supplier_id   uuid references companies(id) on delete set null,
    rate          numeric(14,2) not null default 0,
    currency      text not null default 'USD',
    uom           text,
    valid_from    date,
    valid_upto    date,
    note          text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_itemprices_product on item_prices(product_id);
create index if not exists idx_itemprices_lab on item_prices(lab_id);
create index if not exists idx_itemprices_list on item_prices(price_list);

-- ---------------------------------------------------------------------
-- fn_effective_price: the price that applies to a product for a given lab
-- on a given date. Preference order:
--   1. a price scoped to that specific lab
--   2. a general (lab-agnostic) price
-- within the validity window, most-recent valid_from wins. Falls back to
-- the product's default_sell_price when no item price matches.
-- ---------------------------------------------------------------------
create or replace function fn_effective_price(
    p_product_id uuid,
    p_lab_id     uuid default null,
    p_date       date default current_date,
    p_selling    boolean default true
)
returns numeric
language sql
stable
as $$
    select coalesce(
        (select ip.rate
           from item_prices ip
          where ip.product_id = p_product_id
            and ip.selling = p_selling
            and (ip.valid_from is null or ip.valid_from <= p_date)
            and (ip.valid_upto is null or ip.valid_upto >= p_date)
            and (ip.lab_id = p_lab_id or ip.lab_id is null)
          order by (ip.lab_id = p_lab_id) desc nulls last,  -- lab-specific first
                   ip.valid_from desc nulls last
          limit 1),
        (select default_sell_price from products where id = p_product_id),
        0
    );
$$;

-- ---------------------------------------------------------------------
-- View: item prices with product + lab names for listing
-- ---------------------------------------------------------------------
create or replace view v_item_prices as
select
    ip.*,
    p.item_code,
    p.name          as product_name,
    l.name          as lab_name,
    c.name          as supplier_name
from item_prices ip
join products p on p.id = ip.product_id
left join labs l on l.id = ip.lab_id
left join companies c on c.id = ip.supplier_id;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table item_prices enable row level security;
drop policy if exists "authenticated_all" on item_prices;
create policy "authenticated_all" on item_prices
    for all to authenticated using (true) with check (true);

-- ===== migration: 0012_payment_terms.sql =====
-- =====================================================================
-- Migration 0012 : Payment Terms
--
-- Ported from ERPNext "Payment Term". A reusable credit term that yields a
-- due date from an invoice date. Wired into purchase_invoices so each
-- purchase gets an automatic due date (what we owe the supplier and when).
-- =====================================================================

do $$ begin
    create type due_date_basis as enum (
        'day_after_invoice',       -- Day(s) after invoice date
        'day_after_month_end',     -- Day(s) after the end of the invoice month
        'month_after_month_end'    -- Month(s) after the end of the invoice month
    );
exception when duplicate_object then null; end $$;

create table if not exists payment_terms (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null unique,
    invoice_portion    numeric(6,2) not null default 100,   -- % of invoice
    mode_of_payment    text,
    due_date_based_on  due_date_basis not null default 'day_after_invoice',
    credit_days        int not null default 0,
    credit_months      int not null default 0,
    description        text,
    created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- fn_due_date: compute a due date from a base date and a term rule
-- ---------------------------------------------------------------------
create or replace function fn_due_date(
    p_base   date,
    p_basis  due_date_basis,
    p_days   int,
    p_months int
)
returns date
language sql
immutable
as $$
    select case p_basis
        when 'day_after_invoice' then
            p_base + p_days
        when 'day_after_month_end' then
            (date_trunc('month', p_base) + interval '1 month - 1 day')::date + p_days
        when 'month_after_month_end' then
            ((date_trunc('month', p_base) + interval '1 month - 1 day')::date
                + (p_months || ' months')::interval)::date
    end;
$$;

-- ---------------------------------------------------------------------
-- Attach payment terms to purchases and auto-fill the due date
-- ---------------------------------------------------------------------
alter table purchase_invoices
    add column if not exists payment_term_id uuid references payment_terms(id) on delete set null,
    add column if not exists due_date date;

create or replace function trg_purchase_due_date()
returns trigger
language plpgsql
as $$
declare t payment_terms%rowtype;
begin
    if new.payment_term_id is not null then
        select * into t from payment_terms where id = new.payment_term_id;
        if found then
            new.due_date := fn_due_date(new.posting_date, t.due_date_based_on, t.credit_days, t.credit_months);
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists t_purchase_due_date on purchase_invoices;
create trigger t_purchase_due_date
    before insert or update of payment_term_id, posting_date on purchase_invoices
    for each row execute function trg_purchase_due_date();

-- ---------------------------------------------------------------------
-- RLS + seed a few common terms
-- ---------------------------------------------------------------------
alter table payment_terms enable row level security;
drop policy if exists "authenticated_all" on payment_terms;
create policy "authenticated_all" on payment_terms
    for all to authenticated using (true) with check (true);

insert into payment_terms (name, due_date_based_on, credit_days) values
    ('Due on Receipt', 'day_after_invoice', 0),
    ('Net 30',         'day_after_invoice', 30),
    ('Net 60',         'day_after_invoice', 60)
on conflict (name) do nothing;

-- ===== migration: 0013_master_data.sql =====
-- =====================================================================
-- Migration 0013 : Reference masters
--
-- Ported from ERPNext DocTypes UOM, Brand, Item Group and Mode of Payment.
-- These are controlled-vocabulary masters that back the free-text fields
-- already on products / payments, so dropdowns replace ad-hoc typing.
-- (Processed one-by-one from erpnext-reference; sources deleted.)
-- =====================================================================

-- UOM ------------------------------------------------------------------
create table if not exists uoms (
    id                   uuid primary key default gen_random_uuid(),
    uom_name             text not null unique,
    symbol               text,
    must_be_whole_number boolean not null default false,
    enabled              boolean not null default true,
    description          text
);

-- Brand ----------------------------------------------------------------
create table if not exists brands (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

-- Item Group -----------------------------------------------------------
create table if not exists item_groups (
    id                uuid primary key default gen_random_uuid(),
    name              text not null unique,
    parent_item_group text,
    is_group          boolean not null default false
);

-- Mode of Payment ------------------------------------------------------
do $$ begin
    create type mode_of_payment_type as enum ('cash', 'bank', 'general');
exception when duplicate_object then null; end $$;

create table if not exists modes_of_payment (
    id      uuid primary key default gen_random_uuid(),
    name    text not null unique,
    type    mode_of_payment_type not null default 'general',
    enabled boolean not null default true
);

-- Seeds ----------------------------------------------------------------
insert into uoms (uom_name, symbol, must_be_whole_number) values
    ('Nos', 'Nos', true), ('Box', 'Box', true), ('Unit', 'Unit', true),
    ('Pack', 'Pack', true), ('Vial', 'Vial', true), ('Test', 'Test', true),
    ('Litre', 'L', false), ('Millilitre', 'mL', false), ('Kg', 'kg', false)
on conflict (uom_name) do nothing;

insert into brands (name) values ('Roche'), ('Siemens'), ('Sysmex'), ('Abbott'), ('Beckman Coulter')
on conflict (name) do nothing;

insert into item_groups (name, is_group) values
    ('Devices', false), ('Reagents', false), ('Spare Parts', false), ('Consumables', false)
on conflict (name) do nothing;

insert into modes_of_payment (name, type) values
    ('Cash', 'cash'), ('Wire Transfer', 'bank'), ('Cheque', 'bank'), ('Card', 'bank')
on conflict (name) do nothing;

-- RLS ------------------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array['uoms', 'brands', 'item_groups', 'modes_of_payment']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0014_price_lists.sql =====
-- =====================================================================
-- Migration 0014 : Price List
--
-- Ported from ERPNext "Price List" — the named list that item_prices.
-- price_list references. Turns that free-text field into a controlled
-- master with currency + buying/selling flags.
-- =====================================================================

create table if not exists price_lists (
    id             uuid primary key default gen_random_uuid(),
    price_list_name text not null unique,
    currency       text not null default 'USD',
    buying         boolean not null default false,
    selling        boolean not null default true,
    enabled        boolean not null default true,
    created_at     timestamptz not null default now()
);

insert into price_lists (price_list_name, selling, buying) values
    ('Standard Selling', true, false),
    ('Standard Buying', false, true)
on conflict (price_list_name) do nothing;

alter table price_lists enable row level security;
drop policy if exists "authenticated_all" on price_lists;
create policy "authenticated_all" on price_lists
    for all to authenticated using (true) with check (true);

-- ===== migration: 0015_serial_numbers.sql =====
-- =====================================================================
-- Migration 0015 : Serial No
--
-- Ported from ERPNext "Serial No" — tracks individual serialized units of a
-- product (e.g. spare parts / components) with warranty & lifecycle status,
-- current warehouse or lab, and optional link to a device.
-- =====================================================================

do $$ begin
    create type serial_status as enum ('active','inactive','consumed','delivered','expired');
exception when duplicate_object then null; end $$;

do $$ begin
    create type serial_warranty_status as enum
        ('under_warranty','out_of_warranty','under_amc','out_of_amc');
exception when duplicate_object then null; end $$;

create table if not exists serial_numbers (
    id                   uuid primary key default gen_random_uuid(),
    serial_no            text not null unique,
    product_id           uuid not null references products(id) on delete restrict,
    status               serial_status not null default 'active',
    maintenance_status   serial_warranty_status,
    -- current location: a warehouse (in stock) or a lab (delivered)
    warehouse_id         uuid references warehouses(id) on delete set null,
    lab_id               uuid references labs(id) on delete set null,
    -- optional link to a tracked device this part belongs to
    device_id            uuid references devices(id) on delete set null,
    batch_no             text,
    purchase_rate        numeric(14,2) not null default 0,
    warranty_period_days int,
    warranty_expiry_date date,
    amc_expiry_date      date,
    posting_date         date not null default current_date,
    description          text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists idx_serial_product on serial_numbers(product_id);
create index if not exists idx_serial_status on serial_numbers(status);
create index if not exists idx_serial_lab on serial_numbers(lab_id);

-- Warranty alert view (mirrors the device maintenance-alert idea)
create or replace view v_serial_warranty_alerts as
select
    s.id, s.serial_no, p.name as product_name, l.name as lab_name,
    s.warranty_expiry_date,
    (s.warranty_expiry_date - current_date) as days_until_expiry
from serial_numbers s
join products p on p.id = s.product_id
left join labs l on l.id = s.lab_id
where s.warranty_expiry_date is not null
  and s.status = 'active'
  and s.warranty_expiry_date <= current_date + interval '60 days'
order by s.warranty_expiry_date;

alter table serial_numbers enable row level security;
drop policy if exists "authenticated_all" on serial_numbers;
create policy "authenticated_all" on serial_numbers
    for all to authenticated using (true) with check (true);

-- ===== migration: 0016_warranty_claims.sql =====
-- =====================================================================
-- Migration 0016 : Warranty Claim
--
-- Ported from ERPNext "Warranty Claim" — a service complaint against a
-- serialized unit (or device) from a lab, with warranty/AMC status and a
-- resolution trail.
-- =====================================================================

do $$ begin
    create type warranty_claim_status as enum ('open','work_in_progress','closed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists warranty_claims (
    id                 uuid primary key default gen_random_uuid(),
    naming_series      text,
    status             warranty_claim_status not null default 'open',
    complaint_date     date not null default current_date,
    serial_number_id   uuid references serial_numbers(id) on delete set null,
    device_id          uuid references devices(id) on delete set null,
    product_id         uuid references products(id) on delete set null,
    lab_id             uuid references labs(id) on delete set null,
    complaint          text,
    warranty_amc_status serial_warranty_status,
    warranty_expiry_date date,
    amc_expiry_date    date,
    complaint_raised_by text,
    contact_mobile     text,
    contact_email      text,
    resolution_date    timestamptz,
    resolved_by        text,
    resolution_details text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_wc_status on warranty_claims(status);
create index if not exists idx_wc_lab on warranty_claims(lab_id);
create index if not exists idx_wc_serial on warranty_claims(serial_number_id);

-- open claims feed for a support dashboard
create or replace view v_open_warranty_claims as
select
    w.id, w.naming_series, w.complaint_date, w.status,
    w.complaint, w.warranty_amc_status,
    p.name as product_name, l.name as lab_name, s.serial_no
from warranty_claims w
left join products p on p.id = w.product_id
left join labs l on l.id = w.lab_id
left join serial_numbers s on s.id = w.serial_number_id
where w.status in ('open','work_in_progress')
order by w.complaint_date;

alter table warranty_claims enable row level security;
drop policy if exists "authenticated_all" on warranty_claims;
create policy "authenticated_all" on warranty_claims
    for all to authenticated using (true) with check (true);

-- ===== migration: 0017_sales_orders.sql =====
-- =====================================================================
-- Migration 0017 : Sales Order
--
-- Ported from ERPNext "Sales Order". A lab's order for products; when
-- delivered it posts sales rows (reusing the existing profit logic:
-- sell = order rate, cost = product default buy price).
-- =====================================================================

do $$ begin
    create type so_status as enum ('draft','confirmed','delivered','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sales_orders (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    lab_id           uuid not null references labs(id) on delete restrict,
    transaction_date date not null default current_date,
    delivery_date    date,
    status           so_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,
    currency         text not null default 'USD',
    notes            text,
    delivered_at     timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists sales_order_items (
    id             uuid primary key default gen_random_uuid(),
    sales_order_id uuid not null references sales_orders(id) on delete cascade,
    product_id     uuid not null references products(id) on delete restrict,
    qty            numeric(14,2) not null check (qty > 0),
    rate           numeric(14,2) not null default 0,
    amount         numeric(14,2) generated always as (qty * rate) stored,
    created_at     timestamptz not null default now()
);

create index if not exists idx_soitems_order on sales_order_items(sales_order_id);

-- keep the order total in sync
create or replace function trg_sync_so_total()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.sales_order_id, old.sales_order_id);
begin
    update sales_orders
       set total_amount = coalesce((select sum(amount) from sales_order_items where sales_order_id = v_id), 0),
           updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_so_total on sales_order_items;
create trigger t_sync_so_total
    after insert or update or delete on sales_order_items
    for each row execute function trg_sync_so_total();

-- deliver: post sales rows from the order items
create or replace function fn_deliver_sales_order(p_so_id uuid)
returns int language plpgsql as $$
declare
    v_status so_status; v_lab uuid; it record; v_buy numeric; n int := 0;
begin
    select status, lab_id into v_status, v_lab from sales_orders where id = p_so_id;
    if not found then raise exception 'Sales order not found'; end if;
    if v_status = 'delivered' then raise exception 'Sales order already delivered'; end if;
    if v_status = 'cancelled' then raise exception 'Sales order is cancelled'; end if;

    for it in select * from sales_order_items where sales_order_id = p_so_id loop
        select default_buy_price into v_buy from products where id = it.product_id;
        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (v_lab, it.product_id, it.qty, coalesce(v_buy, 0), it.rate);
        n := n + 1;
    end loop;

    update sales_orders set status = 'delivered', delivered_at = now(), updated_at = now()
     where id = p_so_id;
    return n;
end; $$;

alter table sales_orders enable row level security;
alter table sales_order_items enable row level security;
drop policy if exists "authenticated_all" on sales_orders;
drop policy if exists "authenticated_all" on sales_order_items;
create policy "authenticated_all" on sales_orders for all to authenticated using (true) with check (true);
create policy "authenticated_all" on sales_order_items for all to authenticated using (true) with check (true);

-- ===== migration: 0018_segmentation.sql =====
-- =====================================================================
-- Migration 0018 : Territory & Customer Group
--
-- Ported from ERPNext "Territory" and "Customer Group" — segmentation
-- masters for labs (a lab has a territory and a group). Enables grouping
-- for reporting and default pricing later.
-- =====================================================================

create table if not exists territories (
    id               uuid primary key default gen_random_uuid(),
    name             text not null unique,
    parent_territory text,
    is_group         boolean not null default false,
    manager          text
);

create table if not exists customer_groups (
    id                    uuid primary key default gen_random_uuid(),
    name                  text not null unique,
    parent_customer_group text,
    is_group              boolean not null default false,
    default_price_list    text,
    credit_limit          numeric(14,2)
);

-- attach to labs (a lab is our "customer")
alter table labs
    add column if not exists territory      text,
    add column if not exists customer_group text;

insert into territories (name, is_group) values
    ('All Territories', true), ('Baghdad', false), ('Basra', false),
    ('Erbil', false), ('Mosul', false)
on conflict (name) do nothing;

insert into customer_groups (name, is_group, default_price_list) values
    ('All Customer Groups', true, null),
    ('Government Labs', false, 'Standard Selling'),
    ('Private Labs', false, 'Standard Selling'),
    ('Hospital Labs', false, 'Standard Selling')
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['territories', 'customer_groups']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0019_categories.sql =====
-- =====================================================================
-- Migration 0019 : Asset Category & Supplier Group
--
-- Ported from ERPNext "Asset Category" and "Supplier Group". Simple masters:
-- a device carries an asset category; a company (supplier) a supplier group.
-- =====================================================================

create table if not exists asset_categories (
    id                     uuid primary key default gen_random_uuid(),
    name                   text not null unique,
    non_depreciable        boolean not null default false
);

create table if not exists supplier_groups (
    id                    uuid primary key default gen_random_uuid(),
    name                  text not null unique,
    parent_supplier_group text,
    is_group              boolean not null default false
);

alter table devices   add column if not exists asset_category text;
alter table companies add column if not exists supplier_group text;

insert into asset_categories (name) values
    ('Chemistry Analyzers'), ('Hematology Analyzers'),
    ('Immunoassay Analyzers'), ('Microscopes'), ('Centrifuges')
on conflict (name) do nothing;

insert into supplier_groups (name, is_group) values
    ('All Supplier Groups', true), ('Manufacturers', false),
    ('Distributors', false), ('Local Suppliers', false)
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['asset_categories', 'supplier_groups']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0020_leads.sql =====
-- =====================================================================
-- Migration 0020 : Lead (CRM)
--
-- Ported from ERPNext "Lead" — a prospective lab (sales pipeline) before it
-- becomes an active lab/customer. Can be converted to a lab.
-- =====================================================================

do $$ begin
    create type lead_status as enum
        ('lead','open','replied','opportunity','quotation','interested',
         'converted','do_not_contact');
exception when duplicate_object then null; end $$;

create table if not exists leads (
    id             uuid primary key default gen_random_uuid(),
    lead_name      text not null,
    company_name   text,
    status         lead_status not null default 'lead',
    email          text,
    phone          text,
    mobile_no      text,
    territory      text,
    industry       text,
    city           text,
    country        text,
    source         text,
    qualification_status text,
    -- once converted, points at the created lab
    converted_lab_id uuid references labs(id) on delete set null,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_leads_status on leads(status);

-- Convert a lead into an active lab and mark it converted.
create or replace function fn_convert_lead(p_lead_id uuid, p_code text)
returns uuid
language plpgsql
as $$
declare v_lead leads%rowtype; v_lab uuid;
begin
    select * into v_lead from leads where id = p_lead_id;
    if not found then raise exception 'Lead not found'; end if;
    if v_lead.converted_lab_id is not null then raise exception 'Lead already converted'; end if;

    insert into labs (code, name, status, city, territory, contact_name, phone, email)
    values (p_code, coalesce(v_lead.company_name, v_lead.lead_name), 'active',
            v_lead.city, v_lead.territory, v_lead.lead_name, coalesce(v_lead.mobile_no, v_lead.phone), v_lead.email)
    returning id into v_lab;

    update leads set status = 'converted', converted_lab_id = v_lab, updated_at = now()
     where id = p_lead_id;
    return v_lab;
end;
$$;

alter table leads enable row level security;
drop policy if exists "authenticated_all" on leads;
create policy "authenticated_all" on leads
    for all to authenticated using (true) with check (true);

-- ===== migration: 0021_opportunities.sql =====
-- =====================================================================
-- Migration 0021 : Opportunity (CRM)
--
-- Ported from ERPNext "Opportunity" — a qualified sales opportunity, from a
-- lead or an existing lab, with an expected amount, stage and probability.
-- Sits between Lead and Sales Order in the pipeline.
-- =====================================================================

do $$ begin
    create type opportunity_status as enum ('open','quotation','converted','lost','closed');
exception when duplicate_object then null; end $$;

create table if not exists opportunities (
    id                 uuid primary key default gen_random_uuid(),
    title              text not null,
    -- source party: a lead or an existing lab
    lead_id            uuid references leads(id) on delete set null,
    lab_id             uuid references labs(id) on delete set null,
    status             opportunity_status not null default 'open',
    opportunity_type   text,
    sales_stage        text default 'Prospecting',
    opportunity_amount numeric(14,2) not null default 0,
    probability        numeric(5,2) not null default 0,   -- percent
    currency           text not null default 'USD',
    expected_closing   date,
    territory          text,
    contact_email      text,
    contact_mobile     text,
    notes              text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_opps_status on opportunities(status);

-- weighted pipeline value view (amount * probability)
create or replace view v_pipeline_summary as
select
    coalesce(sum(opportunity_amount) filter (where status = 'open'), 0)             as open_amount,
    coalesce(sum(opportunity_amount * probability / 100) filter (where status = 'open'), 0) as weighted_amount,
    count(*) filter (where status = 'open')                                          as open_count,
    count(*) filter (where status = 'converted')                                     as won_count,
    count(*) filter (where status = 'lost')                                          as lost_count
from opportunities;

alter table opportunities enable row level security;
drop policy if exists "authenticated_all" on opportunities;
create policy "authenticated_all" on opportunities
    for all to authenticated using (true) with check (true);

-- ===== migration: 0022_quotations.sql =====
-- =====================================================================
-- Migration 0022 : Quotation
--
-- Ported from ERPNext "Quotation". A priced quote to a lab; when accepted it
-- converts into a Sales Order (which in turn posts sales on delivery).
-- =====================================================================

do $$ begin
    create type quotation_status as enum ('draft','submitted','ordered','lost','expired');
exception when duplicate_object then null; end $$;

create table if not exists quotations (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    lab_id           uuid not null references labs(id) on delete restrict,
    opportunity_id   uuid references opportunities(id) on delete set null,
    transaction_date date not null default current_date,
    valid_till       date,
    status           quotation_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,
    currency         text not null default 'USD',
    notes            text,
    sales_order_id   uuid references sales_orders(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists quotation_items (
    id            uuid primary key default gen_random_uuid(),
    quotation_id  uuid not null references quotations(id) on delete cascade,
    product_id    uuid not null references products(id) on delete restrict,
    qty           numeric(14,2) not null check (qty > 0),
    rate          numeric(14,2) not null default 0,
    amount        numeric(14,2) generated always as (qty * rate) stored,
    created_at    timestamptz not null default now()
);

create index if not exists idx_qitems_quote on quotation_items(quotation_id);

create or replace function trg_sync_quote_total()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.quotation_id, old.quotation_id);
begin
    update quotations
       set total_amount = coalesce((select sum(amount) from quotation_items where quotation_id = v_id), 0),
           updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_quote_total on quotation_items;
create trigger t_sync_quote_total
    after insert or update or delete on quotation_items
    for each row execute function trg_sync_quote_total();

-- Convert an accepted quotation into a draft sales order (copying its items).
create or replace function fn_quotation_to_sales_order(p_quote_id uuid)
returns uuid language plpgsql as $$
declare v_status quotation_status; v_lab uuid; v_so uuid; it record;
begin
    select status, lab_id into v_status, v_lab from quotations where id = p_quote_id;
    if not found then raise exception 'Quotation not found'; end if;
    if v_status = 'ordered' then raise exception 'Quotation already ordered'; end if;

    insert into sales_orders (lab_id, transaction_date, status)
    values (v_lab, current_date, 'confirmed')
    returning id into v_so;

    for it in select * from quotation_items where quotation_id = p_quote_id loop
        insert into sales_order_items (sales_order_id, product_id, qty, rate)
        values (v_so, it.product_id, it.qty, it.rate);
    end loop;

    update quotations set status = 'ordered', sales_order_id = v_so, updated_at = now()
     where id = p_quote_id;
    return v_so;
end; $$;

alter table quotations enable row level security;
alter table quotation_items enable row level security;
drop policy if exists "authenticated_all" on quotations;
drop policy if exists "authenticated_all" on quotation_items;
create policy "authenticated_all" on quotations for all to authenticated using (true) with check (true);
create policy "authenticated_all" on quotation_items for all to authenticated using (true) with check (true);

-- ===== migration: 0023_stock_reconciliation.sql =====
-- =====================================================================
-- Migration 0023 : Stock Reconciliation
--
-- Ported from ERPNext "Stock Reconciliation". A physical count that sets the
-- actual available quantity of kit batches; posting it adjusts qty_available
-- and records the difference.
-- =====================================================================

do $$ begin
    create type stock_recon_status as enum ('draft','posted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists stock_reconciliations (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    posting_date  date not null default current_date,
    status        stock_recon_status not null default 'draft',
    notes         text,
    posted_at     timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists stock_reconciliation_items (
    id                uuid primary key default gen_random_uuid(),
    reconciliation_id uuid not null references stock_reconciliations(id) on delete cascade,
    kit_batch_id      uuid not null references kit_batches(id) on delete restrict,
    counted_qty       numeric(14,2) not null,
    -- snapshotted current qty at posting time
    previous_qty      numeric(14,2),
    difference        numeric(14,2),
    created_at        timestamptz not null default now()
);

create index if not exists idx_sritems_recon on stock_reconciliation_items(reconciliation_id);

-- Post: set each batch qty_available to the counted qty, record the diff.
create or replace function fn_post_stock_reconciliation(p_recon_id uuid)
returns int language plpgsql as $$
declare v_status stock_recon_status; it record; v_cur numeric; n int := 0;
begin
    select status into v_status from stock_reconciliations where id = p_recon_id;
    if not found then raise exception 'Reconciliation not found'; end if;
    if v_status = 'posted' then raise exception 'Already posted'; end if;

    for it in select * from stock_reconciliation_items where reconciliation_id = p_recon_id loop
        select qty_available into v_cur from kit_batches where id = it.kit_batch_id;
        update stock_reconciliation_items
           set previous_qty = v_cur, difference = it.counted_qty - v_cur
         where id = it.id;
        update kit_batches
           set qty_available = it.counted_qty, updated_at = now()
         where id = it.kit_batch_id;
        n := n + 1;
    end loop;

    update stock_reconciliations set status = 'posted', posted_at = now() where id = p_recon_id;
    return n;
end; $$;

alter table stock_reconciliations enable row level security;
alter table stock_reconciliation_items enable row level security;
drop policy if exists "authenticated_all" on stock_reconciliations;
drop policy if exists "authenticated_all" on stock_reconciliation_items;
create policy "authenticated_all" on stock_reconciliations for all to authenticated using (true) with check (true);
create policy "authenticated_all" on stock_reconciliation_items for all to authenticated using (true) with check (true);

-- ===== migration: 0024_currency_exchange.sql =====
-- =====================================================================
-- Migration 0024 : Currency Exchange
--
-- Ported from ERPNext "Currency Exchange" — dated FX rates between two
-- currencies, with a conversion helper. Lets USD-denominated amounts be
-- shown/settled in a lab's local currency (e.g. IQD).
-- =====================================================================

create table if not exists currency_exchanges (
    id            uuid primary key default gen_random_uuid(),
    date          date not null default current_date,
    from_currency text not null,
    to_currency   text not null,
    exchange_rate numeric(18,6) not null check (exchange_rate > 0),
    for_buying    boolean not null default true,
    for_selling   boolean not null default true,
    created_at    timestamptz not null default now(),
    unique (date, from_currency, to_currency)
);

create index if not exists idx_fx_pair on currency_exchanges(from_currency, to_currency, date);

-- Latest rate on/before a date for a pair; 1.0 for same currency.
create or replace function fn_exchange_rate(
    p_from text,
    p_to   text,
    p_date date default current_date
)
returns numeric
language sql
stable
as $$
    select case
        when p_from = p_to then 1.0
        else coalesce(
            (select exchange_rate from currency_exchanges
              where from_currency = p_from and to_currency = p_to and date <= p_date
              order by date desc limit 1),
            -- try the inverse pair
            (select 1.0 / exchange_rate from currency_exchanges
              where from_currency = p_to and to_currency = p_from and date <= p_date
              order by date desc limit 1),
            1.0)
    end;
$$;

-- Convert an amount between currencies at the effective rate.
create or replace function fn_convert_amount(
    p_amount numeric,
    p_from   text,
    p_to     text,
    p_date   date default current_date
)
returns numeric
language sql
stable
as $$
    select round(p_amount * fn_exchange_rate(p_from, p_to, p_date), 2);
$$;

insert into currency_exchanges (date, from_currency, to_currency, exchange_rate) values
    (current_date, 'USD', 'IQD', 1310.000000),
    (current_date, 'USD', 'EUR', 0.920000)
on conflict do nothing;

alter table currency_exchanges enable row level security;
drop policy if exists "authenticated_all" on currency_exchanges;
create policy "authenticated_all" on currency_exchanges
    for all to authenticated using (true) with check (true);

-- ===== migration: 0025_accounts.sql =====
-- =====================================================================
-- Migration 0025 : Account (Chart of Accounts)
--
-- Ported from ERPNext "Account". A lightweight chart of accounts (tree via
-- parent_account) used later by journal entries. Seeded with a minimal CoA.
-- =====================================================================

do $$ begin
    create type account_root_type as enum ('asset','liability','income','expense','equity');
exception when duplicate_object then null; end $$;

create table if not exists accounts (
    id             uuid primary key default gen_random_uuid(),
    account_name   text not null,
    account_number text,
    root_type      account_root_type not null,
    account_type   text,                       -- Bank, Receivable, Payable, Cost of Goods Sold, …
    parent_account text,
    is_group       boolean not null default false,
    currency       text not null default 'USD',
    disabled       boolean not null default false,
    created_at     timestamptz not null default now(),
    unique (account_name)
);

create index if not exists idx_accounts_root on accounts(root_type);

insert into accounts (account_name, account_number, root_type, account_type, is_group, parent_account) values
    ('Application of Funds (Assets)', '1000', 'asset',     null,          true,  null),
    ('Bank Accounts',                 '1100', 'asset',     'Bank',        true,  'Application of Funds (Assets)'),
    ('Accounts Receivable',           '1200', 'asset',     'Receivable',  false, 'Application of Funds (Assets)'),
    ('Stock In Hand',                 '1300', 'asset',     'Stock',       false, 'Application of Funds (Assets)'),
    ('Fixed Assets',                  '1400', 'asset',     'Fixed Asset', false, 'Application of Funds (Assets)'),
    ('Source of Funds (Liabilities)', '2000', 'liability', null,          true,  null),
    ('Accounts Payable',              '2100', 'liability', 'Payable',     false, 'Source of Funds (Liabilities)'),
    ('Income',                        '4000', 'income',    null,          true,  null),
    ('Sales',                         '4100', 'income',    null,          false, 'Income'),
    ('Expenses',                      '5000', 'expense',   null,          true,  null),
    ('Cost of Goods Sold',            '5100', 'expense',   'Cost of Goods Sold', false, 'Expenses'),
    ('Bank Charges',                  '5200', 'expense',   'Expense Account',    false, 'Expenses')
on conflict (account_name) do nothing;

alter table accounts enable row level security;
drop policy if exists "authenticated_all" on accounts;
create policy "authenticated_all" on accounts
    for all to authenticated using (true) with check (true);

-- ===== migration: 0026_journal_entries.sql =====
-- =====================================================================
-- Migration 0026 : Journal Entry
--
-- Ported from ERPNext "Journal Entry" (+ accounts). Double-entry postings
-- against the chart of accounts; a journal can only be posted when its
-- debits equal its credits.
-- =====================================================================

do $$ begin
    create type journal_status as enum ('draft','posted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists journal_entries (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    voucher_type  text not null default 'Journal Entry',
    posting_date  date not null default current_date,
    status        journal_status not null default 'draft',
    cheque_no     text,
    cheque_date   date,
    user_remark   text,
    total_debit   numeric(14,2) not null default 0,
    total_credit  numeric(14,2) not null default 0,
    posted_at     timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists journal_entry_accounts (
    id                uuid primary key default gen_random_uuid(),
    journal_entry_id  uuid not null references journal_entries(id) on delete cascade,
    account           text not null,           -- references accounts.account_name
    debit             numeric(14,2) not null default 0,
    credit            numeric(14,2) not null default 0,
    party_type        party_type,
    party_company_id  uuid references companies(id) on delete set null,
    party_lab_id      uuid references labs(id) on delete set null,
    user_remark       text,
    created_at        timestamptz not null default now()
);

create index if not exists idx_jea_je on journal_entry_accounts(journal_entry_id);

-- keep totals in sync
create or replace function trg_sync_journal_totals()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.journal_entry_id, old.journal_entry_id);
begin
    update journal_entries je
       set total_debit  = coalesce((select sum(debit)  from journal_entry_accounts where journal_entry_id = v_id), 0),
           total_credit = coalesce((select sum(credit) from journal_entry_accounts where journal_entry_id = v_id), 0)
     where je.id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_journal_totals on journal_entry_accounts;
create trigger t_sync_journal_totals
    after insert or update or delete on journal_entry_accounts
    for each row execute function trg_sync_journal_totals();

-- post: only when balanced (debit == credit, > 0)
create or replace function fn_post_journal_entry(p_je_id uuid)
returns void language plpgsql as $$
declare v_status journal_status; v_d numeric; v_c numeric;
begin
    select status, total_debit, total_credit into v_status, v_d, v_c
      from journal_entries where id = p_je_id;
    if not found then raise exception 'Journal entry not found'; end if;
    if v_status = 'posted' then raise exception 'Already posted'; end if;
    if v_d <= 0 then raise exception 'Journal entry has no amounts'; end if;
    if abs(v_d - v_c) > 0.005 then
        raise exception 'Journal entry is not balanced (debit % != credit %)', v_d, v_c;
    end if;
    update journal_entries set status = 'posted', posted_at = now() where id = p_je_id;
end; $$;

alter table journal_entries enable row level security;
alter table journal_entry_accounts enable row level security;
drop policy if exists "authenticated_all" on journal_entries;
drop policy if exists "authenticated_all" on journal_entry_accounts;
create policy "authenticated_all" on journal_entries for all to authenticated using (true) with check (true);
create policy "authenticated_all" on journal_entry_accounts for all to authenticated using (true) with check (true);

-- ===== migration: 0027_delivery_notes.sql =====
-- =====================================================================
-- Migration 0027 : Cost Center & Delivery Note
--
-- Ported from ERPNext "Cost Center" (simple master) and "Delivery Note"
-- (+ item). Submitting a delivery note records a withdrawal per line, which
-- the existing stock-movement trigger uses to decrement the kit batch and
-- mark the lab active — closing the "selling reduces batch stock" gap.
-- =====================================================================

-- Cost Center ----------------------------------------------------------
create table if not exists cost_centers (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null unique,
    cost_center_number text,
    parent_cost_center text,
    is_group           boolean not null default false,
    disabled           boolean not null default false
);

insert into cost_centers (name, is_group) values
    ('Main', true), ('Sales', false), ('Service', false), ('Administration', false)
on conflict (name) do nothing;

alter table journal_entry_accounts add column if not exists cost_center text;

-- Delivery Note --------------------------------------------------------
do $$ begin
    create type delivery_status as enum ('draft','delivered','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists delivery_notes (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    lab_id        uuid not null references labs(id) on delete restrict,
    posting_date  date not null default current_date,
    status        delivery_status not null default 'draft',
    notes         text,
    delivered_at  timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists delivery_note_items (
    id               uuid primary key default gen_random_uuid(),
    delivery_note_id uuid not null references delivery_notes(id) on delete cascade,
    kit_batch_id     uuid not null references kit_batches(id) on delete restrict,
    qty              numeric(14,2) not null check (qty > 0),
    created_at       timestamptz not null default now()
);

create index if not exists idx_dnitems_dn on delivery_note_items(delivery_note_id);

-- Submit: post a withdrawal per line (trigger decrements batch + activates lab)
create or replace function fn_submit_delivery_note(p_dn_id uuid)
returns int language plpgsql as $$
declare v_status delivery_status; v_lab uuid; it record; v_buy numeric; v_sell numeric; n int := 0;
begin
    select status, lab_id into v_status, v_lab from delivery_notes where id = p_dn_id;
    if not found then raise exception 'Delivery note not found'; end if;
    if v_status = 'delivered' then raise exception 'Already delivered'; end if;
    if v_status = 'cancelled' then raise exception 'Delivery note is cancelled'; end if;

    for it in select * from delivery_note_items where delivery_note_id = p_dn_id loop
        select buy_price, sell_price into v_buy, v_sell from kit_batches where id = it.kit_batch_id;
        insert into stock_movements (kit_batch_id, lab_id, type, qty, buy_price, sell_price, note)
        values (it.kit_batch_id, v_lab, 'withdrawal', it.qty, coalesce(v_buy,0), coalesce(v_sell,0),
                'Delivery note');
        n := n + 1;
    end loop;

    update delivery_notes set status = 'delivered', delivered_at = now() where id = p_dn_id;
    return n;
end; $$;

do $$
declare t text;
begin
    foreach t in array array['cost_centers','delivery_notes','delivery_note_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0029_material_requests.sql =====
-- =====================================================================
-- Migration 0029 : Material Request
--
-- Ported from ERPNext "Material Request" (Purchase type). An internal request
-- to buy products; it can be turned into a draft purchase invoice.
-- =====================================================================

do $$ begin
    create type mr_status as enum ('draft','ordered','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists material_requests (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    transaction_date date not null default current_date,
    required_by      date,
    status           mr_status not null default 'draft',
    notes            text,
    purchase_id      uuid references purchase_invoices(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists material_request_items (
    id                  uuid primary key default gen_random_uuid(),
    material_request_id uuid not null references material_requests(id) on delete cascade,
    product_id          uuid not null references products(id) on delete restrict,
    qty                 numeric(14,2) not null check (qty > 0),
    warehouse_id        uuid references warehouses(id) on delete set null,
    created_at          timestamptz not null default now()
);

create index if not exists idx_mritems_mr on material_request_items(material_request_id);

-- Convert to a draft purchase invoice (rate = product default buy price)
create or replace function fn_material_request_to_purchase(p_mr_id uuid)
returns uuid language plpgsql as $$
declare v_status mr_status; v_po uuid; it record; v_buy numeric;
begin
    select status into v_status from material_requests where id = p_mr_id;
    if not found then raise exception 'Material request not found'; end if;
    if v_status = 'ordered' then raise exception 'Material request already ordered'; end if;

    insert into purchase_invoices (posting_date) values (current_date) returning id into v_po;
    for it in select * from material_request_items where material_request_id = p_mr_id loop
        select default_buy_price into v_buy from products where id = it.product_id;
        insert into purchase_items (purchase_id, product_id, qty, rate, warehouse_id)
        values (v_po, it.product_id, it.qty, coalesce(v_buy, 0), it.warehouse_id);
    end loop;

    update material_requests set status = 'ordered', purchase_id = v_po, updated_at = now() where id = p_mr_id;
    return v_po;
end; $$;

alter table material_requests enable row level security;
alter table material_request_items enable row level security;
drop policy if exists "authenticated_all" on material_requests;
drop policy if exists "authenticated_all" on material_request_items;
create policy "authenticated_all" on material_requests for all to authenticated using (true) with check (true);
create policy "authenticated_all" on material_request_items for all to authenticated using (true) with check (true);

-- ===== migration: 0030_supplier_quotations.sql =====
-- =====================================================================
-- Migration 0030 : Supplier Quotation
--
-- Ported from ERPNext "Supplier Quotation" (+ item). A supplier's price
-- offer for products; it can be turned into a draft purchase invoice
-- (completing the buying pipeline: Material Request → Supplier Quotation →
-- Purchase).
-- =====================================================================

do $$ begin
    create type sq_status as enum ('draft','submitted','ordered','cancelled','expired');
exception when duplicate_object then null; end $$;

create table if not exists supplier_quotations (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    supplier_id      uuid references companies(id) on delete set null,
    transaction_date date not null default current_date,
    valid_till       date,
    status           sq_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,
    currency         text not null default 'USD',
    notes            text,
    purchase_id      uuid references purchase_invoices(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists supplier_quotation_items (
    id                    uuid primary key default gen_random_uuid(),
    supplier_quotation_id uuid not null references supplier_quotations(id) on delete cascade,
    product_id            uuid not null references products(id) on delete restrict,
    qty                   numeric(14,2) not null check (qty > 0),
    rate                  numeric(14,2) not null default 0,
    amount                numeric(14,2) generated always as (qty * rate) stored,
    created_at            timestamptz not null default now()
);

create index if not exists idx_sqitems_sq on supplier_quotation_items(supplier_quotation_id);

create or replace function trg_sync_sq_total()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.supplier_quotation_id, old.supplier_quotation_id);
begin
    update supplier_quotations set total_amount = coalesce((select sum(amount) from supplier_quotation_items where supplier_quotation_id = v_id), 0), updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_sq_total on supplier_quotation_items;
create trigger t_sync_sq_total
    after insert or update or delete on supplier_quotation_items
    for each row execute function trg_sync_sq_total();

create or replace function fn_supplier_quotation_to_purchase(p_sq_id uuid)
returns uuid language plpgsql as $$
declare v_status sq_status; v_supplier uuid; v_po uuid; it record;
begin
    select status, supplier_id into v_status, v_supplier from supplier_quotations where id = p_sq_id;
    if not found then raise exception 'Supplier quotation not found'; end if;
    if v_status = 'ordered' then raise exception 'Supplier quotation already ordered'; end if;

    insert into purchase_invoices (supplier_id, posting_date) values (v_supplier, current_date) returning id into v_po;
    for it in select * from supplier_quotation_items where supplier_quotation_id = p_sq_id loop
        insert into purchase_items (purchase_id, product_id, qty, rate)
        values (v_po, it.product_id, it.qty, it.rate);
    end loop;

    update supplier_quotations set status = 'ordered', purchase_id = v_po, updated_at = now() where id = p_sq_id;
    return v_po;
end; $$;

alter table supplier_quotations enable row level security;
alter table supplier_quotation_items enable row level security;
drop policy if exists "authenticated_all" on supplier_quotations;
drop policy if exists "authenticated_all" on supplier_quotation_items;
create policy "authenticated_all" on supplier_quotations for all to authenticated using (true) with check (true);
create policy "authenticated_all" on supplier_quotation_items for all to authenticated using (true) with check (true);

-- ===== migration: 0031_sales_team.sql =====
-- =====================================================================
-- Migration 0031 : Warehouse Type, Sales Person, Sales Partner
--
-- Ported from ERPNext masters. Warehouse Type backs the warehouses.
-- warehouse_type field; Sales Person / Sales Partner are the sales team /
-- channel masters (with commission rate).
-- =====================================================================

create table if not exists warehouse_types (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

create table if not exists sales_persons (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null unique,
    parent_sales_person text,
    commission_rate    numeric(6,2) not null default 0,
    is_group           boolean not null default false,
    enabled            boolean not null default true
);

create table if not exists sales_partners (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,
    partner_type    text,
    territory       text,
    commission_rate numeric(6,2) not null default 0,
    referral_code   text
);

insert into warehouse_types (name) values ('Stock'), ('Cold'), ('Transit'), ('Rejected')
on conflict (name) do nothing;

insert into sales_persons (name, commission_rate, is_group) values
    ('Sales Team', 0, true), ('Ali Hassan', 5, false), ('Sara Kareem', 5, false)
on conflict (name) do nothing;

insert into sales_partners (name, partner_type, commission_rate) values
    ('MedSupply Co', 'Distributor', 8), ('LabDirect', 'Reseller', 6)
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['warehouse_types','sales_persons','sales_partners']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0032_taxes.sql =====
-- =====================================================================
-- Migration 0032 : Tax Category & Taxes and Charges Templates
--
-- Ported from ERPNext "Tax Category" and the Sales/Purchase "Taxes and
-- Charges Template" (+ rows). A reusable named set of tax lines (rate %)
-- that can be attached to a transaction to compute tax.
-- =====================================================================

do $$ begin
    create type tax_applies_to as enum ('selling','buying');
exception when duplicate_object then null; end $$;

create table if not exists tax_categories (
    id       uuid primary key default gen_random_uuid(),
    title    text not null unique,
    disabled boolean not null default false
);

create table if not exists tax_templates (
    id            uuid primary key default gen_random_uuid(),
    title         text not null unique,
    applies_to    tax_applies_to not null default 'selling',
    tax_category  text,
    is_default    boolean not null default false,
    disabled      boolean not null default false,
    created_at    timestamptz not null default now()
);

create table if not exists tax_template_rows (
    id           uuid primary key default gen_random_uuid(),
    template_id  uuid not null references tax_templates(id) on delete cascade,
    description  text not null,
    account_head text,
    rate         numeric(6,3) not null default 0,   -- percent
    created_at   timestamptz not null default now()
);

create index if not exists idx_taxrows_t on tax_template_rows(template_id);

-- compute the tax amount a template adds to a net amount
create or replace function fn_template_tax(p_template_id uuid, p_net numeric)
returns numeric language sql stable as $$
    select coalesce(sum(p_net * rate / 100), 0)
    from tax_template_rows where template_id = p_template_id;
$$;

insert into tax_categories (title) values ('Standard'), ('Exempt')
on conflict (title) do nothing;

do $$
declare v_id uuid;
begin
    if not exists (select 1 from tax_templates where title = 'VAT 0%') then
        insert into tax_templates (title, applies_to, tax_category, is_default) values ('VAT 0%', 'selling', 'Exempt', true) returning id into v_id;
        insert into tax_template_rows (template_id, description, rate) values (v_id, 'VAT', 0);
    end if;
end $$;

do $$
declare t text;
begin
    foreach t in array array['tax_categories','tax_templates','tax_template_rows']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0033_manufacturing.sql =====
-- =====================================================================
-- Migration 0033 : Bill of Materials + Work Order (kit assembly)
--
-- Ported (lightened) from ERPNext "BOM", "BOM Item" and "Work Order".
-- A BOM lists the component products (and qty) consumed to assemble one
-- finished product — here, a reagent kit (كت) built from its parts.
-- A Work Order executes a BOM: on completion it produces a kit_batch of
-- the finished product, priced at the BOM raw-material cost.
-- =====================================================================

do $$ begin
    create type work_order_status as enum
        ('draft','in_process','completed','stopped','cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- BOMs
create table if not exists boms (
    id                uuid primary key default gen_random_uuid(),
    bom_no            text not null unique,
    product_id        uuid not null references products(id) on delete restrict,
    quantity          numeric(14,2) not null default 1,   -- fg qty this BOM yields
    uom               text,
    is_active         boolean not null default true,
    is_default        boolean not null default false,
    raw_material_cost numeric(14,2) not null default 0,   -- synced from rows
    description       text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_boms_product on boms(product_id);

create table if not exists bom_items (
    id              uuid primary key default gen_random_uuid(),
    bom_id          uuid not null references boms(id) on delete cascade,
    component_id    uuid not null references products(id) on delete restrict,
    qty             numeric(14,3) not null default 1,
    uom             text,
    rate            numeric(14,2) not null default 0,
    amount          numeric(14,2) generated always as (qty * rate) stored,
    source_warehouse uuid references warehouses(id) on delete set null,
    created_at      timestamptz not null default now()
);

create index if not exists idx_bomitems_bom on bom_items(bom_id);

-- keep boms.raw_material_cost = sum of its rows' amounts
create or replace function fn_sync_bom_cost() returns trigger
language plpgsql as $$
declare v_bom uuid;
begin
    v_bom := coalesce(new.bom_id, old.bom_id);
    update boms set
        raw_material_cost = coalesce((select sum(amount) from bom_items where bom_id = v_bom), 0),
        updated_at = now()
    where id = v_bom;
    return null;
end $$;

drop trigger if exists trg_sync_bom_cost on bom_items;
create trigger trg_sync_bom_cost
    after insert or update or delete on bom_items
    for each row execute function fn_sync_bom_cost();

-- ---------------------------------------------------------- Work Orders
create table if not exists work_orders (
    id             uuid primary key default gen_random_uuid(),
    wo_no          text not null unique,
    status         work_order_status not null default 'draft',
    product_id     uuid not null references products(id) on delete restrict,
    bom_id         uuid references boms(id) on delete set null,
    qty            numeric(14,2) not null default 1,   -- fg qty to produce
    produced_qty   numeric(14,2) not null default 0,
    fg_warehouse   uuid references warehouses(id) on delete set null,
    batch_id       uuid references kit_batches(id) on delete set null,  -- produced batch
    planned_start  date,
    planned_end    date,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_wo_status on work_orders(status);
create index if not exists idx_wo_product on work_orders(product_id);

-- Complete a work order: create a kit_batch of the finished product,
-- priced at the BOM's per-unit raw-material cost. Returns the batch id.
create or replace function fn_complete_work_order(p_wo_id uuid)
returns uuid language plpgsql as $$
declare
    v_wo      work_orders%rowtype;
    v_bom     boms%rowtype;
    v_unit    numeric(14,2) := 0;
    v_batch   uuid;
    v_batchno text;
begin
    select * into v_wo from work_orders where id = p_wo_id for update;
    if not found then raise exception 'Work order % not found', p_wo_id; end if;
    if v_wo.status = 'completed' then
        raise exception 'Work order % already completed', v_wo.wo_no;
    end if;
    if v_wo.status = 'cancelled' then
        raise exception 'Work order % is cancelled', v_wo.wo_no;
    end if;

    if v_wo.bom_id is not null then
        select * into v_bom from boms where id = v_wo.bom_id;
        if found and v_bom.quantity > 0 then
            v_unit := round(v_bom.raw_material_cost / v_bom.quantity, 2);
        end if;
    end if;

    v_batchno := 'WO-' || v_wo.wo_no;

    insert into kit_batches (batch_no, product_id, warehouse_id,
                             manufacturing_date, qty_received, qty_available, buy_price)
    values (v_batchno, v_wo.product_id, v_wo.fg_warehouse,
            current_date, v_wo.qty, v_wo.qty, v_unit)
    on conflict (batch_no, product_id) do update
        set qty_received  = kit_batches.qty_received + excluded.qty_received,
            qty_available = kit_batches.qty_available + excluded.qty_available
    returning id into v_batch;

    update work_orders set
        status       = 'completed',
        produced_qty = v_wo.qty,
        batch_id     = v_batch,
        updated_at   = now()
    where id = p_wo_id;

    return v_batch;
end $$;

-- ------------------------------------------------------------------ RLS
do $$
declare t text;
begin
    foreach t in array array['boms','bom_items','work_orders']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0034_maintenance_visits.sql =====
-- =====================================================================
-- Migration 0034 : Maintenance Visit (device service records)
--
-- Ported (lightened) from ERPNext "Maintenance Visit" (+ purpose rows).
-- A visit records a service call to a lab covering one or more devices:
-- preventive (scheduled), unscheduled, or breakdown. On submit each
-- serviced device gets a maintenance_logs row and its next-maintenance
-- date is rolled forward.
-- =====================================================================

do $$ begin
    create type maintenance_type as enum ('scheduled','unscheduled','breakdown');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_completion as enum ('pending','partial','full');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_visit_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists maintenance_visits (
    id                uuid primary key default gen_random_uuid(),
    visit_no          text not null unique,
    lab_id            uuid references labs(id) on delete set null,
    visit_date        date not null default current_date,
    visit_time        time,
    maintenance_type  maintenance_type not null default 'scheduled',
    completion_status maintenance_completion not null default 'pending',
    status            maintenance_visit_status not null default 'draft',
    service_person    text,
    customer_feedback text,
    notes             text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_mvisits_lab on maintenance_visits(lab_id);
create index if not exists idx_mvisits_status on maintenance_visits(status);
create index if not exists idx_mvisits_date on maintenance_visits(visit_date);

create table if not exists maintenance_visit_purposes (
    id             uuid primary key default gen_random_uuid(),
    visit_id       uuid not null references maintenance_visits(id) on delete cascade,
    device_id      uuid references devices(id) on delete set null,
    work_done      text,
    service_person text,
    next_due_date  date,
    created_at     timestamptz not null default now()
);

create index if not exists idx_mvpurposes_visit on maintenance_visit_purposes(visit_id);

-- Submit a visit: log each serviced device and roll its next-maintenance
-- date forward. A breakdown visit clears the device's in_maintenance state
-- back to installed (it is fixed and returned to service in the lab).
create or replace function fn_submit_maintenance_visit(p_visit_id uuid)
returns integer language plpgsql as $$
declare
    v_visit maintenance_visits%rowtype;
    v_row   record;
    v_count integer := 0;
begin
    select * into v_visit from maintenance_visits where id = p_visit_id for update;
    if not found then raise exception 'Maintenance visit % not found', p_visit_id; end if;
    if v_visit.status = 'submitted' then
        raise exception 'Visit % already submitted', v_visit.visit_no;
    end if;
    if v_visit.status = 'cancelled' then
        raise exception 'Visit % is cancelled', v_visit.visit_no;
    end if;

    for v_row in
        select * from maintenance_visit_purposes where visit_id = p_visit_id and device_id is not null
    loop
        insert into maintenance_logs (device_id, performed_on, performed_by, description, next_due_date)
        values (v_row.device_id, v_visit.visit_date,
                coalesce(v_row.service_person, v_visit.service_person),
                v_row.work_done, v_row.next_due_date);

        update devices set
            next_maintenance_date = coalesce(v_row.next_due_date, next_maintenance_date),
            status = case when status = 'in_maintenance' then 'installed'::device_status else status end,
            updated_at = now()
        where id = v_row.device_id;

        v_count := v_count + 1;
    end loop;

    update maintenance_visits set status = 'submitted', updated_at = now()
    where id = p_visit_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['maintenance_visits','maintenance_visit_purposes']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0035_stock_entries.sql =====
-- =====================================================================
-- Migration 0035 : Stock Entry (kit-batch receipt / issue / transfer)
--
-- Ported (lightened) from ERPNext "Stock Entry" (+ detail rows). Covers
-- the three core purposes over kit batches:
--   receipt  -> add qty into a warehouse
--   issue    -> remove qty from a warehouse
--   transfer -> move a batch's location to another warehouse
-- On submit the batch's qty_available / warehouse_id are updated.
-- =====================================================================

do $$ begin
    create type stock_entry_purpose as enum ('receipt','issue','transfer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type stock_entry_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists stock_entries (
    id             uuid primary key default gen_random_uuid(),
    entry_no       text not null unique,
    purpose        stock_entry_purpose not null default 'transfer',
    status         stock_entry_status not null default 'draft',
    posting_date   date not null default current_date,
    from_warehouse uuid references warehouses(id) on delete set null,
    to_warehouse   uuid references warehouses(id) on delete set null,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_stentry_status on stock_entries(status);
create index if not exists idx_stentry_date on stock_entries(posting_date);

create table if not exists stock_entry_items (
    id         uuid primary key default gen_random_uuid(),
    entry_id   uuid not null references stock_entries(id) on delete cascade,
    batch_id   uuid not null references kit_batches(id) on delete restrict,
    qty        numeric(14,2) not null default 0 check (qty >= 0),
    rate       numeric(14,2) not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_stitems_entry on stock_entry_items(entry_id);

-- Submit a stock entry: apply each row against its batch. Returns the
-- number of rows applied.
create or replace function fn_submit_stock_entry(p_entry_id uuid)
returns integer language plpgsql as $$
declare
    v_entry stock_entries%rowtype;
    v_row   record;
    v_avail numeric(14,2);
    v_count integer := 0;
begin
    select * into v_entry from stock_entries where id = p_entry_id for update;
    if not found then raise exception 'Stock entry % not found', p_entry_id; end if;
    if v_entry.status = 'submitted' then
        raise exception 'Stock entry % already submitted', v_entry.entry_no;
    end if;
    if v_entry.status = 'cancelled' then
        raise exception 'Stock entry % is cancelled', v_entry.entry_no;
    end if;

    for v_row in select * from stock_entry_items where entry_id = p_entry_id loop
        if v_entry.purpose = 'receipt' then
            update kit_batches set
                qty_received  = qty_received + v_row.qty,
                qty_available = qty_available + v_row.qty,
                warehouse_id  = coalesce(v_entry.to_warehouse, warehouse_id),
                updated_at    = now()
            where id = v_row.batch_id;

        elsif v_entry.purpose = 'issue' then
            select qty_available into v_avail from kit_batches where id = v_row.batch_id for update;
            if v_avail < v_row.qty then
                raise exception 'Batch % has only % available, cannot issue %',
                    v_row.batch_id, v_avail, v_row.qty;
            end if;
            update kit_batches set
                qty_available = qty_available - v_row.qty,
                updated_at    = now()
            where id = v_row.batch_id;

        else -- transfer: move the batch's location
            update kit_batches set
                warehouse_id = coalesce(v_entry.to_warehouse, warehouse_id),
                updated_at   = now()
            where id = v_row.batch_id;
        end if;

        v_count := v_count + 1;
    end loop;

    update stock_entries set status = 'submitted', updated_at = now()
    where id = p_entry_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['stock_entries','stock_entry_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0036_quality_inspections.sql =====
-- =====================================================================
-- Migration 0036 : Quality Inspection (incoming/outgoing QC)
--
-- Ported (lightened) from ERPNext "Quality Inspection" (+ reading rows).
-- Records a QC check against a product / kit batch / device with a set of
-- parameter readings. fn_evaluate_quality_inspection() auto-grades numeric
-- readings against their min/max and rolls the pass/fail up to the header.
-- =====================================================================

do $$ begin
    create type qi_inspection_type as enum ('incoming','outgoing','in_process');
exception when duplicate_object then null; end $$;

do $$ begin
    create type qi_status as enum ('pending','accepted','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type qi_reading_status as enum ('accepted','rejected');
exception when duplicate_object then null; end $$;

create table if not exists quality_inspections (
    id              uuid primary key default gen_random_uuid(),
    qi_no           text not null unique,
    report_date     date not null default current_date,
    inspection_type qi_inspection_type not null default 'incoming',
    status          qi_status not null default 'pending',
    product_id      uuid references products(id) on delete set null,
    batch_id        uuid references kit_batches(id) on delete set null,
    device_id       uuid references devices(id) on delete set null,
    sample_size     numeric(14,2) not null default 1,
    inspected_by    text,
    remarks         text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_qi_status on quality_inspections(status);
create index if not exists idx_qi_batch on quality_inspections(batch_id);
create index if not exists idx_qi_device on quality_inspections(device_id);

create table if not exists quality_inspection_readings (
    id            uuid primary key default gen_random_uuid(),
    qi_id         uuid not null references quality_inspections(id) on delete cascade,
    parameter     text not null,
    numeric_check boolean not null default true,   -- numeric vs textual criterion
    reading_value numeric(14,4),
    value         text,                            -- textual reading
    min_value     numeric(14,4),
    max_value     numeric(14,4),
    status        qi_reading_status not null default 'accepted',
    created_at    timestamptz not null default now()
);

create index if not exists idx_qireadings_qi on quality_inspection_readings(qi_id);

-- Grade numeric readings against min/max, then roll pass/fail up to the
-- header (rejected if any reading fails). Returns the resulting status.
create or replace function fn_evaluate_quality_inspection(p_qi_id uuid)
returns qi_status language plpgsql as $$
declare
    v_rejected integer;
    v_result   qi_status;
begin
    -- auto-grade numeric readings that carry bounds
    update quality_inspection_readings r set
        status = case
            when (r.min_value is not null and r.reading_value < r.min_value)
              or (r.max_value is not null and r.reading_value > r.max_value)
            then 'rejected'::qi_reading_status
            else 'accepted'::qi_reading_status
        end
    where r.qi_id = p_qi_id
      and r.numeric_check
      and r.reading_value is not null
      and (r.min_value is not null or r.max_value is not null);

    select count(*) into v_rejected
    from quality_inspection_readings
    where qi_id = p_qi_id and status = 'rejected';

    v_result := case when v_rejected > 0 then 'rejected'::qi_status else 'accepted'::qi_status end;

    update quality_inspections
    set status = v_result, updated_at = now()
    where id = p_qi_id and status not in ('cancelled');

    return v_result;
end $$;

do $$
declare t text;
begin
    foreach t in array array['quality_inspections','quality_inspection_readings']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0037_asset_movements.sql =====
-- =====================================================================
-- Migration 0037 : Asset Movement (device relocation history)
--
-- Ported (lightened) from ERPNext "Asset Movement" (+ item rows). Records
-- moving one or more devices between labs / warehouses and custodians:
--   issue    -> device goes out to a lab (status installed)
--   receipt  -> device returns to a warehouse (status in_stock)
--   transfer -> device moves lab-to-lab / warehouse-to-warehouse
-- On submit each device's location + custodian are updated and the row's
-- source columns are snapshotted for the audit trail.
-- =====================================================================

do $$ begin
    create type asset_movement_purpose as enum ('issue','receipt','transfer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type asset_movement_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists asset_movements (
    id               uuid primary key default gen_random_uuid(),
    movement_no      text not null unique,
    purpose          asset_movement_purpose not null default 'transfer',
    status           asset_movement_status not null default 'draft',
    transaction_date timestamptz not null default now(),
    notes            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists idx_assetmov_status on asset_movements(status);
create index if not exists idx_assetmov_date on asset_movements(transaction_date);

create table if not exists asset_movement_items (
    id                  uuid primary key default gen_random_uuid(),
    movement_id         uuid not null references asset_movements(id) on delete cascade,
    device_id           uuid not null references devices(id) on delete restrict,
    target_lab_id       uuid references labs(id) on delete set null,
    target_warehouse_id uuid references warehouses(id) on delete set null,
    to_custodian        text,
    -- snapshotted from the device at submit time
    source_lab_id       uuid references labs(id) on delete set null,
    source_warehouse_id uuid references warehouses(id) on delete set null,
    from_custodian      text,
    created_at          timestamptz not null default now()
);

create index if not exists idx_assetmovitems_mov on asset_movement_items(movement_id);
create index if not exists idx_assetmovitems_device on asset_movement_items(device_id);

-- Submit a movement: relocate each device and snapshot where it came from.
-- Returns the number of devices moved.
create or replace function fn_submit_asset_movement(p_movement_id uuid)
returns integer language plpgsql as $$
declare
    v_mov   asset_movements%rowtype;
    v_row   record;
    v_dev   devices%rowtype;
    v_count integer := 0;
begin
    select * into v_mov from asset_movements where id = p_movement_id for update;
    if not found then raise exception 'Asset movement % not found', p_movement_id; end if;
    if v_mov.status = 'submitted' then
        raise exception 'Asset movement % already submitted', v_mov.movement_no;
    end if;
    if v_mov.status = 'cancelled' then
        raise exception 'Asset movement % is cancelled', v_mov.movement_no;
    end if;

    for v_row in select * from asset_movement_items where movement_id = p_movement_id loop
        select * into v_dev from devices where id = v_row.device_id for update;

        -- snapshot source for the audit trail
        update asset_movement_items set
            source_lab_id       = v_dev.lab_id,
            source_warehouse_id = v_dev.warehouse_id,
            from_custodian      = v_dev.custodian_name
        where id = v_row.id;

        update devices set
            lab_id         = v_row.target_lab_id,
            warehouse_id   = v_row.target_warehouse_id,
            custodian_name = coalesce(v_row.to_custodian, custodian_name),
            status = case
                when v_row.target_lab_id is not null then 'installed'::device_status
                when v_row.target_warehouse_id is not null then 'in_stock'::device_status
                else status
            end,
            updated_at = now()
        where id = v_row.device_id;

        v_count := v_count + 1;
    end loop;

    update asset_movements set status = 'submitted', updated_at = now()
    where id = p_movement_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['asset_movements','asset_movement_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0038_asset_repairs.sql =====
-- =====================================================================
-- Migration 0038 : Asset Repair (device breakdown repair)
--
-- Ported (lightened) from ERPNext "Asset Repair". Records a breakdown
-- repair on a device: failure/completion dates, actions performed, cost
-- and downtime. On completion a maintenance_logs row is written and the
-- device is returned to service (installed if it has a lab, else in_stock).
-- =====================================================================

do $$ begin
    create type asset_repair_status as enum ('pending','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists asset_repairs (
    id                uuid primary key default gen_random_uuid(),
    repair_no         text not null unique,
    device_id         uuid not null references devices(id) on delete restrict,
    status            asset_repair_status not null default 'pending',
    failure_date      date not null default current_date,
    completion_date   date,
    description       text,
    actions_performed text,
    downtime          text,
    repair_cost       numeric(14,2) not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_repairs_device on asset_repairs(device_id);
create index if not exists idx_repairs_status on asset_repairs(status);

-- When a repair is raised the device is taken out of service.
create or replace function fn_open_asset_repair() returns trigger
language plpgsql as $$
begin
    update devices set status = 'in_maintenance'::device_status, updated_at = now()
    where id = new.device_id
      and status in ('installed','out_of_order');
    return new;
end $$;

drop trigger if exists trg_open_asset_repair on asset_repairs;
create trigger trg_open_asset_repair
    after insert on asset_repairs
    for each row execute function fn_open_asset_repair();

-- Complete a repair: log it and return the device to service.
create or replace function fn_complete_asset_repair(p_repair_id uuid, p_completion date default current_date)
returns void language plpgsql as $$
declare
    v_rep asset_repairs%rowtype;
    v_dev devices%rowtype;
begin
    select * into v_rep from asset_repairs where id = p_repair_id for update;
    if not found then raise exception 'Asset repair % not found', p_repair_id; end if;
    if v_rep.status = 'completed' then
        raise exception 'Repair % already completed', v_rep.repair_no;
    end if;
    if v_rep.status = 'cancelled' then
        raise exception 'Repair % is cancelled', v_rep.repair_no;
    end if;

    select * into v_dev from devices where id = v_rep.device_id for update;

    insert into maintenance_logs (device_id, performed_on, description, cost)
    values (v_rep.device_id, p_completion,
            coalesce(v_rep.actions_performed, v_rep.description, 'Repair ' || v_rep.repair_no),
            v_rep.repair_cost);

    update asset_repairs set
        status = 'completed', completion_date = p_completion, updated_at = now()
    where id = p_repair_id;

    update devices set
        status = case when v_dev.lab_id is not null then 'installed'::device_status
                      else 'in_stock'::device_status end,
        updated_at = now()
    where id = v_rep.device_id;
end $$;

do $$
declare t text;
begin
    foreach t in array array['asset_repairs']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0039_sales_invoices.sql =====
-- =====================================================================
-- Migration 0039 : Sales Invoice (accounts receivable to labs)
--
-- Ported (lightened) from ERPNext "Sales Invoice" (+ item rows). Bills a
-- lab for products, tracks the outstanding balance and payment status, and
-- can be raised straight from a Sales Order. paid_amount is driven by the
-- record-payment action; outstanding + status follow automatically.
-- =====================================================================

do $$ begin
    create type sales_invoice_status as enum
        ('draft','unpaid','partly_paid','paid','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sales_invoices (
    id             uuid primary key default gen_random_uuid(),
    invoice_no     text not null unique,
    lab_id         uuid not null references labs(id) on delete restrict,
    sales_order_id uuid references sales_orders(id) on delete set null,
    posting_date   date not null default current_date,
    due_date       date,
    status         sales_invoice_status not null default 'draft',
    total_amount   numeric(14,2) not null default 0,   -- synced from items
    paid_amount    numeric(14,2) not null default 0,
    outstanding    numeric(14,2) generated always as (total_amount - paid_amount) stored,
    currency       text not null default 'USD',
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_sinv_lab on sales_invoices(lab_id);
create index if not exists idx_sinv_status on sales_invoices(status);
create index if not exists idx_sinv_date on sales_invoices(posting_date);

create table if not exists sales_invoice_items (
    id          uuid primary key default gen_random_uuid(),
    invoice_id  uuid not null references sales_invoices(id) on delete cascade,
    product_id  uuid not null references products(id) on delete restrict,
    qty         numeric(14,2) not null check (qty > 0),
    rate        numeric(14,2) not null default 0,
    amount      numeric(14,2) generated always as (qty * rate) stored,
    created_at  timestamptz not null default now()
);

create index if not exists idx_sinvitems_inv on sales_invoice_items(invoice_id);

-- keep sales_invoices.total_amount = sum of item amounts, and refresh status
create or replace function fn_sync_invoice_total() returns trigger
language plpgsql as $$
declare v_inv uuid;
begin
    v_inv := coalesce(new.invoice_id, old.invoice_id);
    update sales_invoices set
        total_amount = coalesce((select sum(amount) from sales_invoice_items where invoice_id = v_inv), 0),
        updated_at = now()
    where id = v_inv;
    perform fn_refresh_invoice_status(v_inv);
    return null;
end $$;

drop trigger if exists trg_sync_invoice_total on sales_invoice_items;
create trigger trg_sync_invoice_total
    after insert or update or delete on sales_invoice_items
    for each row execute function fn_sync_invoice_total();

-- derive status from paid vs total (leaves draft/cancelled untouched)
create or replace function fn_refresh_invoice_status(p_invoice_id uuid)
returns void language plpgsql as $$
declare v_inv sales_invoices%rowtype;
begin
    select * into v_inv from sales_invoices where id = p_invoice_id;
    if not found or v_inv.status in ('draft','cancelled') then return; end if;
    update sales_invoices set status = case
        when paid_amount <= 0 then 'unpaid'::sales_invoice_status
        when paid_amount >= total_amount then 'paid'::sales_invoice_status
        else 'partly_paid'::sales_invoice_status
    end
    where id = p_invoice_id;
end $$;

-- submit a draft invoice (draft -> unpaid/paid), then record payments
create or replace function fn_submit_sales_invoice(p_invoice_id uuid)
returns void language plpgsql as $$
begin
    update sales_invoices set status = 'unpaid', updated_at = now()
    where id = p_invoice_id and status = 'draft';
    perform fn_refresh_invoice_status(p_invoice_id);
end $$;

-- record a payment against an invoice; returns the new outstanding
create or replace function fn_record_invoice_payment(p_invoice_id uuid, p_amount numeric)
returns numeric language plpgsql as $$
declare v_inv sales_invoices%rowtype;
begin
    select * into v_inv from sales_invoices where id = p_invoice_id for update;
    if not found then raise exception 'Invoice % not found', p_invoice_id; end if;
    if v_inv.status in ('draft','cancelled') then
        raise exception 'Invoice % is not open for payment', v_inv.invoice_no;
    end if;
    if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
    if v_inv.paid_amount + p_amount > v_inv.total_amount then
        raise exception 'Payment exceeds outstanding (% remaining)',
            v_inv.total_amount - v_inv.paid_amount;
    end if;

    update sales_invoices set paid_amount = paid_amount + p_amount, updated_at = now()
    where id = p_invoice_id;
    perform fn_refresh_invoice_status(p_invoice_id);

    return (select outstanding from sales_invoices where id = p_invoice_id);
end $$;

-- build an invoice from a sales order (copies its items). Returns invoice id.
create or replace function fn_invoice_from_sales_order(p_so_id uuid, p_invoice_no text)
returns uuid language plpgsql as $$
declare v_so sales_orders%rowtype; v_inv uuid;
begin
    select * into v_so from sales_orders where id = p_so_id;
    if not found then raise exception 'Sales order % not found', p_so_id; end if;

    insert into sales_invoices (invoice_no, lab_id, sales_order_id, currency)
    values (p_invoice_no, v_so.lab_id, p_so_id, v_so.currency)
    returning id into v_inv;

    insert into sales_invoice_items (invoice_id, product_id, qty, rate)
    select v_inv, product_id, qty, rate from sales_order_items where sales_order_id = p_so_id;

    return v_inv;
end $$;

do $$
declare t text;
begin
    foreach t in array array['sales_invoices','sales_invoice_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0040_purchase_orders.sql =====
-- =====================================================================
-- Migration 0040 : Purchase Order (procurement before invoicing)
--
-- Ported (lightened) from ERPNext "Purchase Order" (+ item rows). A PO to a
-- supplier that can be converted into the existing purchase_invoices record
-- (which then receives stock via fn_receive_purchase).
-- =====================================================================

do $$ begin
    create type purchase_order_status as enum
        ('draft','submitted','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists purchase_orders (
    id               uuid primary key default gen_random_uuid(),
    po_no            text not null unique,
    supplier_id      uuid references companies(id) on delete set null,
    transaction_date date not null default current_date,
    required_by      date,
    status           purchase_order_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,   -- synced from items
    currency         text not null default 'USD',
    notes            text,
    purchase_id      uuid references purchase_invoices(id) on delete set null,  -- once billed
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists idx_po_supplier on purchase_orders(supplier_id);
create index if not exists idx_po_status on purchase_orders(status);

create table if not exists purchase_order_items (
    id         uuid primary key default gen_random_uuid(),
    po_id      uuid not null references purchase_orders(id) on delete cascade,
    product_id uuid not null references products(id) on delete restrict,
    qty        numeric(14,2) not null check (qty > 0),
    rate       numeric(14,2) not null default 0,
    amount     numeric(14,2) generated always as (qty * rate) stored,
    created_at timestamptz not null default now()
);

create index if not exists idx_poitems_po on purchase_order_items(po_id);

-- keep purchase_orders.total_amount = sum of item amounts
create or replace function fn_sync_po_total() returns trigger
language plpgsql as $$
declare v_po uuid;
begin
    v_po := coalesce(new.po_id, old.po_id);
    update purchase_orders set
        total_amount = coalesce((select sum(amount) from purchase_order_items where po_id = v_po), 0),
        updated_at = now()
    where id = v_po;
    return null;
end $$;

drop trigger if exists trg_sync_po_total on purchase_order_items;
create trigger trg_sync_po_total
    after insert or update or delete on purchase_order_items
    for each row execute function fn_sync_po_total();

create or replace function fn_submit_purchase_order(p_po_id uuid)
returns void language plpgsql as $$
begin
    update purchase_orders set status = 'submitted', updated_at = now()
    where id = p_po_id and status = 'draft';
end $$;

-- Convert a PO into a draft purchase invoice (copies its lines). Marks the
-- PO completed and links it. Returns the new purchase invoice id.
create or replace function fn_po_to_purchase_invoice(p_po_id uuid, p_reference text default null)
returns uuid language plpgsql as $$
declare v_po purchase_orders%rowtype; v_pi uuid;
begin
    select * into v_po from purchase_orders where id = p_po_id for update;
    if not found then raise exception 'Purchase order % not found', p_po_id; end if;
    if v_po.status = 'cancelled' then
        raise exception 'Purchase order % is cancelled', v_po.po_no;
    end if;
    if v_po.purchase_id is not null then
        raise exception 'Purchase order % is already billed', v_po.po_no;
    end if;

    insert into purchase_invoices (supplier_id, reference_no, notes)
    values (v_po.supplier_id, p_reference, 'From ' || v_po.po_no)
    returning id into v_pi;

    insert into purchase_items (purchase_id, product_id, qty, rate)
    select v_pi, product_id, qty, rate from purchase_order_items where po_id = p_po_id;

    update purchase_orders set status = 'completed', purchase_id = v_pi, updated_at = now()
    where id = p_po_id;

    return v_pi;
end $$;

do $$
declare t text;
begin
    foreach t in array array['purchase_orders','purchase_order_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0041_product_bundles.sql =====
-- =====================================================================
-- Migration 0041 : Product Bundle (a kit sold as a set of items)
--
-- Ported (lightened) from ERPNext "Product Bundle" (+ item rows). Unlike a
-- BOM (which is assembled by a work order), a bundle is sold as one item and
-- delivered as its component parts — e.g. a reagent kit shipped with its
-- consumables. bundle_value is kept in sync with the component rows.
-- =====================================================================

create table if not exists product_bundles (
    id           uuid primary key default gen_random_uuid(),
    product_id   uuid not null references products(id) on delete restrict,
    description  text,
    is_active    boolean not null default true,
    bundle_value numeric(14,2) not null default 0,   -- synced from rows
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    unique (product_id)
);

create table if not exists product_bundle_items (
    id           uuid primary key default gen_random_uuid(),
    bundle_id    uuid not null references product_bundles(id) on delete cascade,
    component_id uuid not null references products(id) on delete restrict,
    qty          numeric(14,3) not null default 1,
    rate         numeric(14,2) not null default 0,
    uom          text,
    created_at   timestamptz not null default now()
);

create index if not exists idx_bundleitems_bundle on product_bundle_items(bundle_id);

-- keep product_bundles.bundle_value = sum(qty * rate) of its rows
create or replace function fn_sync_bundle_value() returns trigger
language plpgsql as $$
declare v_bundle uuid;
begin
    v_bundle := coalesce(new.bundle_id, old.bundle_id);
    update product_bundles set
        bundle_value = coalesce((select sum(qty * rate) from product_bundle_items where bundle_id = v_bundle), 0),
        updated_at = now()
    where id = v_bundle;
    return null;
end $$;

drop trigger if exists trg_sync_bundle_value on product_bundle_items;
create trigger trg_sync_bundle_value
    after insert or update or delete on product_bundle_items
    for each row execute function fn_sync_bundle_value();

do $$
declare t text;
begin
    foreach t in array array['product_bundles','product_bundle_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0042_installation_notes.sql =====
-- =====================================================================
-- Migration 0042 : Installation Note (device installation at a lab)
--
-- Ported (lightened) from ERPNext "Installation Note" (+ item rows). Records
-- installing one or more devices at a lab on a given date. On submit each
-- linked device is marked installed at that lab.
-- =====================================================================

do $$ begin
    create type installation_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists installation_notes (
    id         uuid primary key default gen_random_uuid(),
    inst_no    text not null unique,
    lab_id     uuid references labs(id) on delete set null,
    inst_date  date not null default current_date,
    inst_time  time,
    status     installation_status not null default 'draft',
    remarks    text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_installnotes_lab on installation_notes(lab_id);
create index if not exists idx_installnotes_status on installation_notes(status);

create table if not exists installation_note_items (
    id         uuid primary key default gen_random_uuid(),
    note_id    uuid not null references installation_notes(id) on delete cascade,
    device_id  uuid references devices(id) on delete set null,
    serial_no  text,
    qty        numeric(14,2) not null default 1,
    created_at timestamptz not null default now()
);

create index if not exists idx_installitems_note on installation_note_items(note_id);

-- Submit a note: mark each linked device installed at the note's lab.
-- Returns the number of devices installed.
create or replace function fn_submit_installation_note(p_note_id uuid)
returns integer language plpgsql as $$
declare
    v_note  installation_notes%rowtype;
    v_row   record;
    v_count integer := 0;
begin
    select * into v_note from installation_notes where id = p_note_id for update;
    if not found then raise exception 'Installation note % not found', p_note_id; end if;
    if v_note.status = 'submitted' then
        raise exception 'Installation note % already submitted', v_note.inst_no;
    end if;
    if v_note.status = 'cancelled' then
        raise exception 'Installation note % is cancelled', v_note.inst_no;
    end if;

    for v_row in select * from installation_note_items where note_id = p_note_id and device_id is not null loop
        update devices set
            lab_id = v_note.lab_id,
            status = 'installed'::device_status,
            updated_at = now()
        where id = v_row.device_id;
        v_count := v_count + 1;
    end loop;

    update installation_notes set status = 'submitted', updated_at = now()
    where id = p_note_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['installation_notes','installation_note_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0043_maintenance_schedules.sql =====
-- =====================================================================
-- Migration 0043 : Maintenance Schedule (recurring PM plan for a device)
--
-- Ported (lightened) from ERPNext "Maintenance Schedule" (+ detail rows).
-- A recurring preventive-maintenance plan for one device: pick a periodicity
-- and a number of visits, and fn_generate_maintenance_schedule() lays out the
-- dated visit rows. Pairs with Maintenance Visit (which records the actual
-- service) and feeds the device-maintenance-alerts view.
-- =====================================================================

do $$ begin
    create type maintenance_periodicity as enum
        ('weekly','monthly','quarterly','half_yearly','yearly');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_schedule_status as enum ('draft','active','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type schedule_detail_status as enum ('pending','done');
exception when duplicate_object then null; end $$;

create table if not exists maintenance_schedules (
    id           uuid primary key default gen_random_uuid(),
    schedule_no  text not null unique,
    lab_id       uuid references labs(id) on delete set null,
    device_id    uuid not null references devices(id) on delete restrict,
    periodicity  maintenance_periodicity not null default 'quarterly',
    start_date   date not null default current_date,
    no_of_visits integer not null default 4 check (no_of_visits > 0),
    status       maintenance_schedule_status not null default 'draft',
    notes        text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists idx_mscheds_device on maintenance_schedules(device_id);
create index if not exists idx_mscheds_status on maintenance_schedules(status);

create table if not exists maintenance_schedule_details (
    id                uuid primary key default gen_random_uuid(),
    schedule_id       uuid not null references maintenance_schedules(id) on delete cascade,
    scheduled_date    date not null,
    completion_status schedule_detail_status not null default 'pending',
    actual_date       date,
    created_at        timestamptz not null default now()
);

create index if not exists idx_mscheddetails_sched on maintenance_schedule_details(schedule_id);
create index if not exists idx_mschedetails_date on maintenance_schedule_details(scheduled_date);

-- Lay out the visit rows for a schedule (idempotent: clears + regenerates the
-- pending rows), activate it, and set the device's next-maintenance date to
-- the first pending visit. Returns the number of rows generated.
create or replace function fn_generate_maintenance_schedule(p_schedule_id uuid)
returns integer language plpgsql as $$
declare
    v_sched maintenance_schedules%rowtype;
    v_step  interval;
    v_date  date;
    i       integer;
begin
    select * into v_sched from maintenance_schedules where id = p_schedule_id for update;
    if not found then raise exception 'Maintenance schedule % not found', p_schedule_id; end if;
    if v_sched.status = 'cancelled' then
        raise exception 'Schedule % is cancelled', v_sched.schedule_no;
    end if;

    v_step := case v_sched.periodicity
        when 'weekly'      then interval '1 week'
        when 'monthly'     then interval '1 month'
        when 'quarterly'   then interval '3 months'
        when 'half_yearly' then interval '6 months'
        when 'yearly'      then interval '1 year'
    end;

    -- clear any not-yet-done rows and regenerate from start_date
    delete from maintenance_schedule_details
    where schedule_id = p_schedule_id and completion_status = 'pending';

    for i in 0 .. v_sched.no_of_visits - 1 loop
        v_date := (v_sched.start_date + (v_step * i))::date;
        insert into maintenance_schedule_details (schedule_id, scheduled_date)
        values (p_schedule_id, v_date);
    end loop;

    update maintenance_schedules set status = 'active', updated_at = now()
    where id = p_schedule_id;

    -- surface the earliest upcoming visit on the device
    update devices set
        maintenance_required = true,
        next_maintenance_date = (
            select min(scheduled_date) from maintenance_schedule_details
            where schedule_id = p_schedule_id and completion_status = 'pending'
              and scheduled_date >= current_date
        ),
        updated_at = now()
    where id = v_sched.device_id;

    return v_sched.no_of_visits;
end $$;

do $$
declare t text;
begin
    foreach t in array array['maintenance_schedules','maintenance_schedule_details']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0044_invoice_payments.sql =====
-- =====================================================================
-- Migration 0044 : Sales Invoice payment ledger
--
-- Records each payment received against a sales invoice (so the invoice
-- detail page can show a real payment history). fn_record_invoice_payment
-- is extended to write a ledger row alongside updating paid_amount.
-- =====================================================================

create table if not exists sales_invoice_payments (
    id         uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references sales_invoices(id) on delete cascade,
    amount     numeric(14,2) not null check (amount > 0),
    paid_on    date not null default current_date,
    note       text,
    created_at timestamptz not null default now()
);

create index if not exists idx_invpay_invoice on sales_invoice_payments(invoice_id);

create or replace function fn_record_invoice_payment(p_invoice_id uuid, p_amount numeric)
returns numeric language plpgsql as $$
declare v_inv sales_invoices%rowtype;
begin
    select * into v_inv from sales_invoices where id = p_invoice_id for update;
    if not found then raise exception 'Invoice % not found', p_invoice_id; end if;
    if v_inv.status in ('draft','cancelled') then
        raise exception 'Invoice % is not open for payment', v_inv.invoice_no;
    end if;
    if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
    if v_inv.paid_amount + p_amount > v_inv.total_amount then
        raise exception 'Payment exceeds outstanding (% remaining)',
            v_inv.total_amount - v_inv.paid_amount;
    end if;

    update sales_invoices set paid_amount = paid_amount + p_amount, updated_at = now()
    where id = p_invoice_id;

    insert into sales_invoice_payments (invoice_id, amount) values (p_invoice_id, p_amount);

    perform fn_refresh_invoice_status(p_invoice_id);

    return (select outstanding from sales_invoices where id = p_invoice_id);
end $$;

do $$ begin
    execute 'alter table sales_invoice_payments enable row level security';
    execute 'drop policy if exists "authenticated_all" on sales_invoice_payments';
    execute 'create policy "authenticated_all" on sales_invoice_payments for all to authenticated using (true) with check (true)';
end $$;

-- ===== migration: 0045_support_issues.sql =====
-- =====================================================================
-- Migration 0045 : Support Issue (device support tickets)
--
-- Ported (lightened) from ERPNext "Issue" (+ Issue Type, Issue Priority).
-- A support ticket raised by a lab, optionally about a specific device,
-- with a simple status workflow and resolution capture.
-- =====================================================================

do $$ begin
    create type issue_status as enum ('open','replied','on_hold','resolved','closed');
exception when duplicate_object then null; end $$;

create table if not exists issue_types (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

create table if not exists issue_priorities (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

create table if not exists issues (
    id                 uuid primary key default gen_random_uuid(),
    issue_no           text not null unique,
    subject            text not null,
    lab_id             uuid references labs(id) on delete set null,
    device_id          uuid references devices(id) on delete set null,
    raised_by          text,
    status             issue_status not null default 'open',
    priority           text,
    issue_type         text,
    description        text,
    resolution_details text,
    opening_date       date not null default current_date,
    resolved_on        date,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_issues_status on issues(status);
create index if not exists idx_issues_lab on issues(lab_id);
create index if not exists idx_issues_device on issues(device_id);

-- Move an issue to a new status; stamp resolved_on when it is closed out,
-- clear it when re-opened.
create or replace function fn_set_issue_status(p_id uuid, p_status issue_status)
returns void language plpgsql as $$
begin
    update issues set
        status = p_status,
        resolved_on = case
            when p_status in ('resolved','closed') then coalesce(resolved_on, current_date)
            else null
        end,
        updated_at = now()
    where id = p_id;
end $$;

insert into issue_types (name) values ('Hardware'), ('Software'), ('Consumable'), ('Installation')
on conflict (name) do nothing;

insert into issue_priorities (name) values ('Low'), ('Medium'), ('High'), ('Urgent')
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['issue_types','issue_priorities','issues']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0046_contracts.sql =====
-- =====================================================================
-- Migration 0046 : Service Contract / AMC
--
-- Ported (lightened) from ERPNext "Contract" (+ Contract Template). An
-- annual maintenance / service contract for a lab (optionally a specific
-- device): term dates, value, status. v_expiring_contracts feeds the
-- dashboard so contracts nearing their end date surface early.
-- =====================================================================

do $$ begin
    create type contract_status as enum ('unsigned','active','inactive','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists contract_templates (
    id            uuid primary key default gen_random_uuid(),
    title         text not null unique,
    contract_terms text,
    created_at    timestamptz not null default now()
);

create table if not exists contracts (
    id             uuid primary key default gen_random_uuid(),
    contract_no    text not null unique,
    lab_id         uuid references labs(id) on delete set null,
    device_id      uuid references devices(id) on delete set null,
    status         contract_status not null default 'unsigned',
    start_date     date,
    end_date       date,
    contract_value numeric(14,2) not null default 0,
    contract_terms text,
    signee         text,
    signed_on      date,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_contracts_status on contracts(status);
create index if not exists idx_contracts_lab on contracts(lab_id);
create index if not exists idx_contracts_end on contracts(end_date);

-- active contracts ending within the next 60 days
create or replace view v_expiring_contracts as
select c.id, c.contract_no, c.end_date, c.contract_value,
       (c.end_date - current_date) as days_left,
       l.name as lab_name, d.asset_code
from contracts c
left join labs l on l.id = c.lab_id
left join devices d on d.id = c.device_id
where c.status = 'active'
  and c.end_date is not null
  and c.end_date >= current_date
  and c.end_date <= current_date + 60
order by c.end_date;

insert into contract_templates (title, contract_terms) values
    ('Standard AMC', 'Annual maintenance: 2 preventive visits + breakdown support within 48h.')
on conflict (title) do nothing;

do $$
declare t text;
begin
    foreach t in array array['contract_templates','contracts']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0047_rfqs.sql =====
-- =====================================================================
-- Migration 0047 : Request for Quotation (multi-supplier)
--
-- Ported (lightened) from ERPNext "Request for Quotation" (+ item & supplier
-- rows). Ask several suppliers to quote the same set of products; each
-- supplier's response becomes a draft Supplier Quotation carrying the RFQ
-- item lines (via fn_rfq_to_supplier_quotation).
-- =====================================================================

do $$ begin
    create type rfq_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type rfq_quote_status as enum ('pending','received');
exception when duplicate_object then null; end $$;

create table if not exists rfqs (
    id               uuid primary key default gen_random_uuid(),
    rfq_no           text not null unique,
    transaction_date date not null default current_date,
    schedule_date    date,
    status           rfq_status not null default 'draft',
    message          text,
    terms            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists rfq_items (
    id         uuid primary key default gen_random_uuid(),
    rfq_id     uuid not null references rfqs(id) on delete cascade,
    product_id uuid not null references products(id) on delete restrict,
    qty        numeric(14,2) not null default 1,
    uom        text,
    created_at timestamptz not null default now()
);

create index if not exists idx_rfqitems_rfq on rfq_items(rfq_id);

create table if not exists rfq_suppliers (
    id                    uuid primary key default gen_random_uuid(),
    rfq_id                uuid not null references rfqs(id) on delete cascade,
    supplier_id           uuid not null references companies(id) on delete restrict,
    quote_status          rfq_quote_status not null default 'pending',
    supplier_quotation_id uuid references supplier_quotations(id) on delete set null,
    created_at            timestamptz not null default now(),
    unique (rfq_id, supplier_id)
);

create index if not exists idx_rfqsuppliers_rfq on rfq_suppliers(rfq_id);

create or replace function fn_submit_rfq(p_rfq_id uuid)
returns void language plpgsql as $$
begin
    update rfqs set status = 'submitted', updated_at = now()
    where id = p_rfq_id and status = 'draft';
end $$;

-- Turn one supplier's line into a draft Supplier Quotation seeded with the
-- RFQ items (rate 0 — to be filled in). Marks that supplier 'received'.
-- Returns the new supplier_quotation id.
create or replace function fn_rfq_to_supplier_quotation(p_rfq_supplier_id uuid, p_quote_no text)
returns uuid language plpgsql as $$
declare v_row rfq_suppliers%rowtype; v_sq uuid;
begin
    select * into v_row from rfq_suppliers where id = p_rfq_supplier_id for update;
    if not found then raise exception 'RFQ supplier % not found', p_rfq_supplier_id; end if;
    if v_row.supplier_quotation_id is not null then
        raise exception 'This supplier already has a quotation';
    end if;

    insert into supplier_quotations (naming_series, supplier_id)
    values (p_quote_no, v_row.supplier_id)
    returning id into v_sq;

    insert into supplier_quotation_items (supplier_quotation_id, product_id, qty, rate)
    select v_sq, product_id, qty, 0 from rfq_items where rfq_id = v_row.rfq_id;

    update rfq_suppliers set quote_status = 'received', supplier_quotation_id = v_sq
    where id = p_rfq_supplier_id;

    return v_sq;
end $$;

do $$
declare t text;
begin
    foreach t in array array['rfqs','rfq_items','rfq_suppliers']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0048_appointments.sql =====
-- =====================================================================
-- Migration 0048 : Appointment (install / service visit scheduling)
--
-- Ported (lightened) from ERPNext "Appointment", reframed for scheduling an
-- installation, service, or training visit at a lab (optionally for a device).
-- =====================================================================

do $$ begin
    create type appointment_status as enum ('open','confirmed','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type appointment_purpose as enum ('installation','service','training','other');
exception when duplicate_object then null; end $$;

create table if not exists appointments (
    id             uuid primary key default gen_random_uuid(),
    appointment_no text not null unique,
    lab_id         uuid references labs(id) on delete set null,
    device_id      uuid references devices(id) on delete set null,
    purpose        appointment_purpose not null default 'service',
    scheduled_time timestamptz not null default now(),
    status         appointment_status not null default 'open',
    contact_name   text,
    contact_phone  text,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_appts_status on appointments(status);
create index if not exists idx_appts_time on appointments(scheduled_time);

do $$ begin
    execute 'alter table appointments enable row level security';
    execute 'drop policy if exists "authenticated_all" on appointments';
    execute 'create policy "authenticated_all" on appointments for all to authenticated using (true) with check (true)';
end $$;

-- ===== migration: 0049_maintenance_teams.sql =====
-- =====================================================================
-- Migration 0049 : Maintenance Team + Task
--
-- Ported (lightened) from ERPNext "Asset Maintenance Team" (+ member rows)
-- and "Asset Maintenance Task". A team of people responsible for device
-- maintenance, plus its recurring task checklist. A PM schedule can be
-- assigned to a team.
-- =====================================================================

do $$ begin
    create type maintenance_task_type as enum ('preventive','calibration');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_task_status as enum ('planned','overdue','done','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists maintenance_teams (
    id           uuid primary key default gen_random_uuid(),
    name         text not null unique,
    manager_name text,
    description  text,
    created_at   timestamptz not null default now()
);

create table if not exists maintenance_team_members (
    id          uuid primary key default gen_random_uuid(),
    team_id     uuid not null references maintenance_teams(id) on delete cascade,
    member_name text not null,
    role        text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_mtmembers_team on maintenance_team_members(team_id);

create table if not exists maintenance_tasks (
    id               uuid primary key default gen_random_uuid(),
    team_id          uuid references maintenance_teams(id) on delete set null,
    task_name        text not null,
    maintenance_type maintenance_task_type not null default 'preventive',
    periodicity      text,
    start_date       date,
    end_date         date,
    status           maintenance_task_status not null default 'planned',
    created_at       timestamptz not null default now()
);

create index if not exists idx_mtasks_team on maintenance_tasks(team_id);

alter table maintenance_schedules
    add column if not exists team_id uuid references maintenance_teams(id) on delete set null;

do $$
declare t text;
begin
    foreach t in array array['maintenance_teams','maintenance_team_members','maintenance_tasks']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0050_credit_limits.sql =====
-- =====================================================================
-- Migration 0050 : Lab credit limit
--
-- Ported (lightened) from ERPNext "Customer Credit Limit". A per-lab credit
-- ceiling; v_lab_credit compares it against the lab's outstanding receivables
-- so labs that are over (or near) their limit can be flagged.
-- =====================================================================

alter table labs add column if not exists credit_limit numeric(14,2) not null default 0;

create or replace view v_lab_credit as
select
    l.id,
    l.code,
    l.name,
    l.credit_limit,
    coalesce((
        select sum(si.outstanding) from sales_invoices si
        where si.lab_id = l.id and si.status <> 'cancelled'
    ), 0) as outstanding,
    case
        when l.credit_limit > 0 and coalesce((
            select sum(si.outstanding) from sales_invoices si
            where si.lab_id = l.id and si.status <> 'cancelled'
        ), 0) > l.credit_limit
        then true else false
    end as over_limit
from labs l
order by l.name;

-- ===== migration: 0051_pricing_rules.sql =====
-- =====================================================================
-- Migration 0051 : Pricing Rule (lab / quantity discounts)
--
-- Ported (lightened) from ERPNext "Pricing Rule". A percentage discount that
-- applies when its conditions match — optionally scoped to a product, a lab,
-- a quantity band, and a validity window. fn_best_discount returns the best
-- matching discount % for a (product, lab, qty).
-- =====================================================================

create table if not exists pricing_rules (
    id                  uuid primary key default gen_random_uuid(),
    title               text not null,
    disabled            boolean not null default false,
    product_id          uuid references products(id) on delete cascade,   -- null = any product
    lab_id              uuid references labs(id) on delete cascade,        -- null = any lab
    min_qty             numeric(14,2) not null default 0,
    max_qty             numeric(14,2),
    discount_percentage numeric(6,2) not null default 0,
    valid_from          date,
    valid_upto          date,
    priority            integer not null default 0,
    created_at          timestamptz not null default now()
);

create index if not exists idx_pricingrules_product on pricing_rules(product_id);
create index if not exists idx_pricingrules_lab on pricing_rules(lab_id);

-- best matching discount % for a product/lab/qty at today's date
create or replace function fn_best_discount(p_product_id uuid, p_lab_id uuid, p_qty numeric)
returns numeric language sql stable as $$
    select coalesce(max(discount_percentage), 0)
    from pricing_rules
    where not disabled
      and (product_id is null or product_id = p_product_id)
      and (lab_id is null or lab_id = p_lab_id)
      and p_qty >= min_qty
      and (max_qty is null or p_qty <= max_qty)
      and (valid_from is null or valid_from <= current_date)
      and (valid_upto is null or valid_upto >= current_date);
$$;

do $$ begin
    execute 'alter table pricing_rules enable row level security';
    execute 'drop policy if exists "authenticated_all" on pricing_rules';
    execute 'create policy "authenticated_all" on pricing_rules for all to authenticated using (true) with check (true)';
end $$;

-- ===== migration: 0052_masters.sql =====
-- =====================================================================
-- Migration 0052 : Lookup masters
--
-- Ported (lightened) from ERPNext "Terms and Conditions", "Sales Stage",
-- "Opportunity Type", "Opportunity Lost Reason". Small reference lists used
-- by the CRM/selling forms, managed on a single /masters admin page.
-- =====================================================================

create table if not exists terms_and_conditions (
    id         uuid primary key default gen_random_uuid(),
    title      text not null unique,
    terms      text,
    created_at timestamptz not null default now()
);

create table if not exists sales_stages (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists opportunity_types (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists opportunity_lost_reasons (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    created_at timestamptz not null default now()
);

insert into sales_stages (name) values
    ('Prospecting'), ('Qualification'), ('Needs Analysis'), ('Proposal'), ('Negotiation'), ('Closed')
on conflict (name) do nothing;

insert into opportunity_types (name) values ('Sales'), ('Maintenance'), ('Support'), ('Installation')
on conflict (name) do nothing;

insert into opportunity_lost_reasons (name) values
    ('Price too high'), ('Chose competitor'), ('No budget'), ('Timing')
on conflict (name) do nothing;

insert into terms_and_conditions (title, terms) values
    ('Standard Sales Terms', 'Payment within 30 days. Goods remain our property until paid in full.')
on conflict (title) do nothing;

do $$
declare t text;
begin
    foreach t in array array['terms_and_conditions','sales_stages','opportunity_types','opportunity_lost_reasons']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0053_stock_balance.sql =====
-- =====================================================================
-- Migration 0053 : Stock Balance report
--
-- ERPNext "Stock Balance" report, expressed as a view: on-hand quantity and
-- valuation per product + warehouse, aggregated from kit_batches.
-- =====================================================================

create or replace view v_stock_balance as
select
    p.id            as product_id,
    p.item_code,
    p.name          as product_name,
    p.product_type,
    w.id            as warehouse_id,
    coalesce(w.name, '(unassigned)') as warehouse_name,
    sum(b.qty_available)                       as qty,
    sum(b.qty_available * b.buy_price)         as stock_value,
    count(*)                                   as batches
from kit_batches b
join products p on p.id = b.product_id
left join warehouses w on w.id = b.warehouse_id
where b.qty_available > 0
group by p.id, p.item_code, p.name, p.product_type, w.id, w.name
order by p.name, warehouse_name;

-- ===== migration: 0054_purchase_receipts.sql =====
-- =====================================================================
-- Migration 0054 : Purchase Receipt (goods receipt)
--
-- Ported (lightened) from ERPNext "Purchase Receipt" (+ item rows). Receives
-- goods against a supplier / purchase order into stock. On submit, kit lines
-- create kit_batches (mirrors the purchase-invoice receive path).
-- =====================================================================

do $$ begin
    create type purchase_receipt_status as enum ('draft','received','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists purchase_receipts (
    id            uuid primary key default gen_random_uuid(),
    receipt_no    text not null unique,
    supplier_id   uuid references companies(id) on delete set null,
    purchase_order_id uuid references purchase_orders(id) on delete set null,
    posting_date  date not null default current_date,
    status        purchase_receipt_status not null default 'draft',
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_prcpt_status on purchase_receipts(status);

create table if not exists purchase_receipt_items (
    id           uuid primary key default gen_random_uuid(),
    receipt_id   uuid not null references purchase_receipts(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    qty          numeric(14,2) not null check (qty > 0),
    rate         numeric(14,2) not null default 0,
    warehouse_id uuid references warehouses(id) on delete set null,
    batch_no     text,
    expiry_date  date,
    created_at   timestamptz not null default now()
);

create index if not exists idx_prcptitems_r on purchase_receipt_items(receipt_id);

-- Submit a receipt: kit lines become kit_batches (received into stock).
-- Returns the number of batches created.
create or replace function fn_submit_purchase_receipt(p_receipt_id uuid)
returns integer language plpgsql as $$
declare
    v_rcpt purchase_receipts%rowtype;
    v_row  record;
    v_prod products%rowtype;
    v_count integer := 0;
begin
    select * into v_rcpt from purchase_receipts where id = p_receipt_id for update;
    if not found then raise exception 'Receipt % not found', p_receipt_id; end if;
    if v_rcpt.status = 'received' then raise exception 'Receipt % already received', v_rcpt.receipt_no; end if;
    if v_rcpt.status = 'cancelled' then raise exception 'Receipt % is cancelled', v_rcpt.receipt_no; end if;

    for v_row in select * from purchase_receipt_items where receipt_id = p_receipt_id loop
        select * into v_prod from products where id = v_row.product_id;
        if v_prod.product_type = 'kit' then
            insert into kit_batches (batch_no, product_id, warehouse_id, supplier_id,
                                     expiry_date, qty_received, qty_available, buy_price)
            values (coalesce(v_row.batch_no, 'PR-' || v_rcpt.receipt_no || '-' || left(v_row.id::text, 8)),
                    v_row.product_id, v_row.warehouse_id, v_rcpt.supplier_id,
                    v_row.expiry_date, v_row.qty, v_row.qty, v_row.rate)
            on conflict (batch_no, product_id) do update
                set qty_received = kit_batches.qty_received + excluded.qty_received,
                    qty_available = kit_batches.qty_available + excluded.qty_available;
            v_count := v_count + 1;
        end if;
    end loop;

    update purchase_receipts set status = 'received', updated_at = now() where id = p_receipt_id;
    return v_count;
end $$;

-- Seed a receipt from a purchase order (copies its lines). Returns receipt id.
create or replace function fn_receipt_from_po(p_po_id uuid, p_receipt_no text)
returns uuid language plpgsql as $$
declare v_po purchase_orders%rowtype; v_r uuid;
begin
    select * into v_po from purchase_orders where id = p_po_id;
    if not found then raise exception 'Purchase order % not found', p_po_id; end if;
    insert into purchase_receipts (receipt_no, supplier_id, purchase_order_id)
    values (p_receipt_no, v_po.supplier_id, p_po_id) returning id into v_r;
    insert into purchase_receipt_items (receipt_id, product_id, qty, rate)
    select v_r, product_id, qty, rate from purchase_order_items where po_id = p_po_id;
    return v_r;
end $$;

do $$
declare t text;
begin
    foreach t in array array['purchase_receipts','purchase_receipt_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0055_payment_requests.sql =====
-- =====================================================================
-- Migration 0055 : Payment Request
--
-- Ported (lightened) from ERPNext "Payment Request". Requests payment against
-- a Sales Invoice for a lab. When marked paid it records the payment on the
-- invoice via the existing fn_record_invoice_payment ledger path, so the
-- receivable balance stays in sync.
-- =====================================================================

do $$ begin
    create type payment_request_status as enum ('draft','requested','paid','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists payment_requests (
    id                uuid primary key default gen_random_uuid(),
    request_no        text not null unique,
    invoice_id        uuid not null references sales_invoices(id) on delete cascade,
    lab_id            uuid references labs(id) on delete set null,
    amount            numeric(14,2) not null check (amount > 0),
    mode_of_payment_id uuid references modes_of_payment(id) on delete set null,
    posting_date      date not null default current_date,
    status            payment_request_status not null default 'draft',
    message           text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_payreq_invoice on payment_requests(invoice_id);
create index if not exists idx_payreq_status on payment_requests(status);

-- Move a draft request to "requested" (i.e. sent to the lab).
create or replace function fn_submit_payment_request(p_request_id uuid)
returns void language plpgsql as $$
declare v_req payment_requests%rowtype;
begin
    select * into v_req from payment_requests where id = p_request_id for update;
    if not found then raise exception 'Payment request % not found', p_request_id; end if;
    if v_req.status <> 'draft' then raise exception 'Payment request % is not a draft', v_req.request_no; end if;
    update payment_requests set status = 'requested', updated_at = now() where id = p_request_id;
end $$;

-- Mark a request paid: record the payment against the invoice and close it.
create or replace function fn_pay_payment_request(p_request_id uuid)
returns numeric language plpgsql as $$
declare v_req payment_requests%rowtype; v_outstanding numeric;
begin
    select * into v_req from payment_requests where id = p_request_id for update;
    if not found then raise exception 'Payment request % not found', p_request_id; end if;
    if v_req.status = 'paid' then raise exception 'Payment request % already paid', v_req.request_no; end if;
    if v_req.status = 'cancelled' then raise exception 'Payment request % is cancelled', v_req.request_no; end if;

    v_outstanding := fn_record_invoice_payment(v_req.invoice_id, v_req.amount);
    update payment_requests set status = 'paid', updated_at = now() where id = p_request_id;
    return v_outstanding;
end $$;

do $$
declare t text;
begin
    foreach t in array array['payment_requests']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0056_blanket_orders.sql =====
-- =====================================================================
-- Migration 0056 : Blanket Order
--
-- Ported (lightened) from ERPNext "Blanket Order": a long-term agreement with a
-- lab (selling) or a supplier (purchasing) for agreed quantities/rates of
-- products over a validity window. Individual sales/purchase orders draw down
-- the agreed quantity; ordered_qty tracks consumption per line.
-- =====================================================================

do $$ begin
    create type blanket_order_type as enum ('selling','purchasing');
exception when duplicate_object then null; end $$;

do $$ begin
    create type blanket_order_status as enum ('draft','active','expired','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists blanket_orders (
    id           uuid primary key default gen_random_uuid(),
    order_no     text not null unique,
    order_type   blanket_order_type not null default 'selling',
    lab_id       uuid references labs(id) on delete set null,
    supplier_id  uuid references companies(id) on delete set null,
    from_date    date not null default current_date,
    to_date      date not null default (current_date + 365),
    status       blanket_order_status not null default 'draft',
    notes        text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    check (to_date >= from_date)
);

create index if not exists idx_blanket_status on blanket_orders(status);
create index if not exists idx_blanket_type on blanket_orders(order_type);

create table if not exists blanket_order_items (
    id           uuid primary key default gen_random_uuid(),
    order_id     uuid not null references blanket_orders(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    qty          numeric(14,2) not null check (qty > 0),
    rate         numeric(14,2) not null default 0,
    ordered_qty  numeric(14,2) not null default 0,
    remaining_qty numeric(14,2) generated always as (qty - ordered_qty) stored,
    created_at   timestamptz not null default now()
);

create index if not exists idx_blanketitems_o on blanket_order_items(order_id);

-- Activate a draft blanket order (draft -> active).
create or replace function fn_submit_blanket_order(p_order_id uuid)
returns void language plpgsql as $$
declare v_bo blanket_orders%rowtype;
begin
    select * into v_bo from blanket_orders where id = p_order_id for update;
    if not found then raise exception 'Blanket order % not found', p_order_id; end if;
    if v_bo.status <> 'draft' then raise exception 'Blanket order % is not a draft', v_bo.order_no; end if;
    if not exists (select 1 from blanket_order_items where order_id = p_order_id) then
        raise exception 'Blanket order % has no items', v_bo.order_no;
    end if;
    update blanket_orders
       set status = case when current_date > to_date then 'expired'::blanket_order_status
                         else 'active'::blanket_order_status end,
           updated_at = now()
     where id = p_order_id;
end $$;

-- Record a draw-down against a line (an order consumes agreed qty).
create or replace function fn_blanket_order_drawdown(p_item_id uuid, p_qty numeric)
returns numeric language plpgsql as $$
declare v_row blanket_order_items%rowtype;
begin
    select * into v_row from blanket_order_items where id = p_item_id for update;
    if not found then raise exception 'Blanket order line % not found', p_item_id; end if;
    if p_qty <= 0 then raise exception 'Draw-down qty must be positive'; end if;
    if v_row.ordered_qty + p_qty > v_row.qty then
        raise exception 'Draw-down exceeds agreed qty (remaining %)', v_row.qty - v_row.ordered_qty;
    end if;
    update blanket_order_items set ordered_qty = ordered_qty + p_qty where id = p_item_id;
    return v_row.qty - v_row.ordered_qty - p_qty;  -- new remaining
end $$;

do $$
declare t text;
begin
    foreach t in array array['blanket_orders','blanket_order_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0057_pick_lists.sql =====
-- =====================================================================
-- Migration 0057 : Pick List
--
-- Ported (lightened) from ERPNext "Pick List": a warehouse picking sheet that
-- consolidates the items to pick (optionally against a sales order) before a
-- Delivery Note is cut. picked_qty tracks progress per line; completing the
-- pick defaults picked_qty to the requested qty.
-- =====================================================================

do $$ begin
    create type pick_list_purpose as enum ('delivery','material_transfer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type pick_list_status as enum ('draft','open','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists pick_lists (
    id             uuid primary key default gen_random_uuid(),
    pick_no        text not null unique,
    lab_id         uuid references labs(id) on delete set null,
    sales_order_id uuid references sales_orders(id) on delete set null,
    purpose        pick_list_purpose not null default 'delivery',
    posting_date   date not null default current_date,
    status         pick_list_status not null default 'draft',
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_picklist_status on pick_lists(status);

create table if not exists pick_list_items (
    id           uuid primary key default gen_random_uuid(),
    pick_id      uuid not null references pick_lists(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    warehouse_id uuid references warehouses(id) on delete set null,
    qty          numeric(14,2) not null check (qty > 0),
    picked_qty   numeric(14,2) not null default 0,
    batch_no     text,
    created_at   timestamptz not null default now()
);

create index if not exists idx_picklistitems_p on pick_list_items(pick_id);

-- Open a draft pick list (draft -> open, i.e. released to the floor).
create or replace function fn_open_pick_list(p_pick_id uuid)
returns void language plpgsql as $$
declare v_pl pick_lists%rowtype;
begin
    select * into v_pl from pick_lists where id = p_pick_id for update;
    if not found then raise exception 'Pick list % not found', p_pick_id; end if;
    if v_pl.status <> 'draft' then raise exception 'Pick list % is not a draft', v_pl.pick_no; end if;
    if not exists (select 1 from pick_list_items where pick_id = p_pick_id) then
        raise exception 'Pick list % has no items', v_pl.pick_no;
    end if;
    update pick_lists set status = 'open', updated_at = now() where id = p_pick_id;
end $$;

-- Complete a pick: any line with no picked_qty defaults to its full qty.
-- Returns the total picked quantity.
create or replace function fn_complete_pick_list(p_pick_id uuid)
returns numeric language plpgsql as $$
declare v_pl pick_lists%rowtype; v_total numeric;
begin
    select * into v_pl from pick_lists where id = p_pick_id for update;
    if not found then raise exception 'Pick list % not found', p_pick_id; end if;
    if v_pl.status = 'completed' then raise exception 'Pick list % already completed', v_pl.pick_no; end if;
    if v_pl.status = 'cancelled' then raise exception 'Pick list % is cancelled', v_pl.pick_no; end if;

    update pick_list_items set picked_qty = qty where pick_id = p_pick_id and picked_qty = 0;
    select coalesce(sum(picked_qty), 0) into v_total from pick_list_items where pick_id = p_pick_id;
    update pick_lists set status = 'completed', updated_at = now() where id = p_pick_id;
    return v_total;
end $$;

do $$
declare t text;
begin
    foreach t in array array['pick_lists','pick_list_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0058_delivery_trips.sql =====
-- =====================================================================
-- Migration 0058 : Delivery Trip
--
-- Ported (lightened) from ERPNext "Delivery Trip": groups delivery notes into a
-- single route with a driver/vehicle and an ordered list of stops (each a lab,
-- optionally tied to a Delivery Note). Starting the trip marks it in transit;
-- completing it marks the trip done and every stop as arrived.
-- =====================================================================

do $$ begin
    create type delivery_trip_status as enum ('draft','scheduled','in_transit','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists delivery_trips (
    id             uuid primary key default gen_random_uuid(),
    trip_no        text not null unique,
    driver_name    text,
    vehicle        text,
    departure_date date not null default current_date,
    status         delivery_trip_status not null default 'draft',
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_deltrip_status on delivery_trips(status);

create table if not exists delivery_trip_stops (
    id               uuid primary key default gen_random_uuid(),
    trip_id          uuid not null references delivery_trips(id) on delete cascade,
    lab_id           uuid references labs(id) on delete set null,
    delivery_note_id uuid references delivery_notes(id) on delete set null,
    address          text,
    seq              integer not null default 1,
    arrived          boolean not null default false,
    created_at       timestamptz not null default now()
);

create index if not exists idx_deltripstops_t on delivery_trip_stops(trip_id);

-- Depart: draft/scheduled -> in_transit.
create or replace function fn_start_delivery_trip(p_trip_id uuid)
returns void language plpgsql as $$
declare v_t delivery_trips%rowtype;
begin
    select * into v_t from delivery_trips where id = p_trip_id for update;
    if not found then raise exception 'Delivery trip % not found', p_trip_id; end if;
    if v_t.status not in ('draft','scheduled') then
        raise exception 'Delivery trip % cannot start from %', v_t.trip_no, v_t.status;
    end if;
    if not exists (select 1 from delivery_trip_stops where trip_id = p_trip_id) then
        raise exception 'Delivery trip % has no stops', v_t.trip_no;
    end if;
    update delivery_trips set status = 'in_transit', updated_at = now() where id = p_trip_id;
end $$;

-- Arrive at all stops and close the trip. Returns the number of stops delivered.
create or replace function fn_complete_delivery_trip(p_trip_id uuid)
returns integer language plpgsql as $$
declare v_t delivery_trips%rowtype; v_count integer;
begin
    select * into v_t from delivery_trips where id = p_trip_id for update;
    if not found then raise exception 'Delivery trip % not found', p_trip_id; end if;
    if v_t.status = 'completed' then raise exception 'Delivery trip % already completed', v_t.trip_no; end if;
    if v_t.status = 'cancelled' then raise exception 'Delivery trip % is cancelled', v_t.trip_no; end if;

    update delivery_trip_stops set arrived = true where trip_id = p_trip_id;
    select count(*) into v_count from delivery_trip_stops where trip_id = p_trip_id;
    update delivery_trips set status = 'completed', updated_at = now() where id = p_trip_id;
    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['delivery_trips','delivery_trip_stops']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== migration: 0059_auth.sql =====
-- =====================================================================
-- Migration 0059 : Application authentication
--
-- A lightweight, self-contained user/login table so the app can be gated behind
-- a sign-in — independent of Supabase Auth, so it works identically on the
-- embedded PGlite backend and on a hosted Postgres (Supabase) database.
-- Passwords are hashed with pgcrypto bcrypt (crypt + gen_salt('bf')).
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
    create type app_user_role as enum ('admin','manager','staff');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null unique,
    password_hash text not null,
    full_name     text,
    role          app_user_role not null default 'staff',
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Verify credentials; returns the (safe) user row only when the password matches.
create or replace function fn_verify_login(p_email text, p_password text)
returns table(id uuid, email text, full_name text, role app_user_role)
language sql as $$
    select u.id, u.email, u.full_name, u.role
    from app_users u
    where lower(u.email) = lower(p_email)
      and u.is_active
      and u.password_hash = crypt(p_password, u.password_hash);
$$;

-- Set / change a user's password (hashes with a fresh bcrypt salt).
create or replace function fn_set_password(p_user_id uuid, p_password text)
returns void language sql as $$
    update app_users
       set password_hash = crypt(p_password, gen_salt('bf')), updated_at = now()
     where id = p_user_id;
$$;

-- Create a user with a plaintext password (hashed on the way in). Idempotent by email.
create or replace function fn_create_user(p_email text, p_password text, p_full_name text, p_role app_user_role)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
    insert into app_users (email, password_hash, full_name, role)
    values (lower(p_email), crypt(p_password, gen_salt('bf')), p_full_name, p_role)
    on conflict (email) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from app_users where lower(email) = lower(p_email); end if;
    return v_id;
end $$;

-- Default administrator. CHANGE THIS PASSWORD after first login (Account page).
insert into app_users (email, password_hash, full_name, role)
values ('admin@spir.local', crypt('admin1234', gen_salt('bf')), 'Administrator', 'admin')
on conflict (email) do nothing;

alter table app_users enable row level security;
drop policy if exists "authenticated_all" on app_users;
create policy "authenticated_all" on app_users for all to authenticated using (true) with check (true);

-- ===== migration: 0060_reports.sql =====
-- =====================================================================
-- Migration 0060 : Reporting views
--
-- Analytical views powering the /reports section: receivables aging, sales by
-- product, sales by lab, product profitability, and purchase spend by supplier.
-- Mirrors ERPNext's standard financial/stock reports, expressed as SQL views.
-- =====================================================================

-- Accounts Receivable aging — every open invoice bucketed by how overdue it is.
create or replace view v_ar_aging as
select
    si.id,
    si.invoice_no,
    l.name                                                              as lab_name,
    si.posting_date,
    si.due_date,
    si.outstanding,
    greatest(0, current_date - coalesce(si.due_date, si.posting_date))::int as days_overdue,
    case
        when current_date - coalesce(si.due_date, si.posting_date) <= 0  then 'current'
        when current_date - coalesce(si.due_date, si.posting_date) <= 30 then '1-30'
        when current_date - coalesce(si.due_date, si.posting_date) <= 60 then '31-60'
        when current_date - coalesce(si.due_date, si.posting_date) <= 90 then '61-90'
        else '90+'
    end                                                                 as bucket
from sales_invoices si
join labs l on l.id = si.lab_id
where si.outstanding > 0 and si.status <> 'cancelled';

-- Sales by product — quantity and revenue per item, from submitted invoices.
create or replace view v_sales_by_product as
select
    p.id                       as product_id,
    p.item_code,
    p.name                     as product_name,
    p.product_type,
    coalesce(sum(sii.qty), 0)  as qty_sold,
    coalesce(sum(sii.amount), 0) as revenue,
    count(distinct sii.invoice_id) as invoices
from sales_invoice_items sii
join sales_invoices si on si.id = sii.invoice_id and si.status <> 'cancelled'
join products p on p.id = sii.product_id
group by p.id, p.item_code, p.name, p.product_type;

-- Sales by lab (customer) — billed, paid and outstanding per lab.
create or replace view v_sales_by_lab as
select
    l.id                       as lab_id,
    l.name                     as lab_name,
    count(si.id)               as invoices,
    coalesce(sum(si.total_amount), 0) as total_billed,
    coalesce(sum(si.paid_amount), 0)  as total_paid,
    coalesce(sum(si.outstanding), 0)  as outstanding
from sales_invoices si
join labs l on l.id = si.lab_id
where si.status <> 'cancelled'
group by l.id, l.name;

-- Profitability by product — revenue vs cost, from the sales ledger.
create or replace view v_profitability as
select
    p.id                                    as product_id,
    p.item_code,
    p.name                                  as product_name,
    coalesce(sum(s.qty), 0)                 as qty,
    coalesce(sum(s.qty * s.sell_price), 0)  as revenue,
    coalesce(sum(s.qty * s.buy_price), 0)   as cost,
    coalesce(sum(s.qty * (s.sell_price - s.buy_price)), 0) as profit
from sales s
join products p on p.id = s.product_id
group by p.id, p.item_code, p.name;

-- Purchase spend by supplier.
create or replace view v_purchase_by_supplier as
select
    c.id                        as supplier_id,
    coalesce(c.name, '(unassigned)') as supplier_name,
    count(distinct pi.id)       as invoices,
    coalesce(sum(pi.total_amount), 0) as total_spend
from purchase_invoices pi
left join companies c on c.id = pi.supplier_id
where pi.status <> 'cancelled'
group by c.id, c.name;

-- ===== migration: 0061_global_search.sql =====
-- =====================================================================
-- Migration 0061 : Global record search
--
-- Backs the awesomebar's "search anything" (like ERPNext's global search):
-- a single function that ILIKE-matches across the main documents and returns
-- a uniform (entity, id, label, sublabel) result set.
-- =====================================================================

create or replace function fn_global_search(p_q text, p_limit int default 8)
returns table(entity text, record_id uuid, label text, sublabel text)
language sql stable as $$
    with q as (select '%' || coalesce(p_q, '') || '%' as pat)
    select * from (
        (select 'lab'::text, l.id, l.name, l.code from labs l, q where l.name ilike q.pat or l.code ilike q.pat limit p_limit)
        union all
        (select 'product', p.id, p.name, p.item_code from products p, q where p.name ilike q.pat or p.item_code ilike q.pat limit p_limit)
        union all
        (select 'company', c.id, c.name, null from companies c, q where c.name ilike q.pat limit p_limit)
        union all
        (select 'device', d.id, d.asset_code, d.serial_no from devices d, q where d.asset_code ilike q.pat or coalesce(d.serial_no,'') ilike q.pat limit p_limit)
        union all
        (select 'sales_invoice', si.id, si.invoice_no, null from sales_invoices si, q where si.invoice_no ilike q.pat limit p_limit)
        union all
        (select 'purchase_order', po.id, po.po_no, null from purchase_orders po, q where po.po_no ilike q.pat limit p_limit)
        union all
        (select 'issue', i.id, i.subject, i.status::text from issues i, q where i.subject ilike q.pat limit p_limit)
    ) hits
    limit (p_limit * 4);
$$;

-- ===== migration: 0062_attachments.sql =====
-- =====================================================================
-- Migration 0062 : File attachments
--
-- Generic attachments for any record (ERPNext's "Attachments" sidebar), stored
-- in the database as base64 text so it works identically on embedded PGlite and
-- hosted Postgres with no external object store. Intended for small files
-- (certificates, contracts, photos); the app caps upload size.
-- =====================================================================

create table if not exists attachments (
    id          uuid primary key default gen_random_uuid(),
    entity      text not null,             -- e.g. 'sales_invoice', 'device', 'issue'
    record_id   uuid not null,
    filename    text not null,
    mime_type   text not null default 'application/octet-stream',
    size_bytes  integer not null default 0,
    data_base64 text not null,
    uploaded_by text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_attachments_rec on attachments(entity, record_id);

alter table attachments enable row level security;
drop policy if exists "authenticated_all" on attachments;
create policy "authenticated_all" on attachments for all to authenticated using (true) with check (true);

-- ===== migration: 0063_iqd_currency.sql =====
-- =====================================================================
-- Migration 0063 : Iraqi Dinar (IQD) + daily USD rate
--
-- Adds a convenience helper for the owner-managed daily USD -> IQD rate and
-- seeds a starting rate (the owner updates it daily from the Currency page).
-- Builds on the existing currency_exchanges table (0024).
-- =====================================================================

-- Today's effective USD -> IQD rate (latest on/before today); 0 if none set.
create or replace function fn_usd_iqd_rate()
returns numeric language sql stable as $$
    select exchange_rate
    from currency_exchanges
    where from_currency = 'USD' and to_currency = 'IQD' and date <= current_date
    order by date desc
    limit 1;
$$;

-- Set / overwrite today's USD -> IQD rate (owner action). Returns the rate.
create or replace function fn_set_usd_iqd_rate(p_rate numeric)
returns numeric language plpgsql as $$
begin
    if p_rate is null or p_rate <= 0 then raise exception 'Rate must be positive'; end if;
    insert into currency_exchanges (date, from_currency, to_currency, exchange_rate, for_buying, for_selling)
    values (current_date, 'USD', 'IQD', p_rate, true, true)
    on conflict (date, from_currency, to_currency)
    do update set exchange_rate = excluded.exchange_rate;
    return p_rate;
end $$;

-- Seed a starting rate so IQD values render out of the box (owner adjusts daily).
insert into currency_exchanges (date, from_currency, to_currency, exchange_rate, for_buying, for_selling)
values (current_date, 'USD', 'IQD', 1310, true, true)
on conflict (date, from_currency, to_currency) do nothing;

-- ===== migration: 0064_amc_billing.sql =====
-- =====================================================================
-- Migration 0064 : Recurring AMC billing (ERPNext "Auto Repeat" / Subscription)
--
-- Lets an Annual Maintenance Contract bill itself on a schedule. Each
-- contract gains a billing interval, the service product to charge, and a
-- next-due date. fn_generate_amc_invoices() sweeps every contract whose
-- next_billing_date has arrived and raises a DRAFT sales invoice for the
-- pro-rated period amount, then advances the schedule — the app calls it
-- from the /amc-billing page (there is no background scheduler).
-- =====================================================================

do $$ begin
    create type amc_billing_interval as enum ('none','monthly','quarterly','annually');
exception when duplicate_object then null; end $$;

alter table contracts
    add column if not exists billing_interval  amc_billing_interval not null default 'none',
    add column if not exists service_product_id uuid references products(id) on delete set null,
    add column if not exists next_billing_date  date,
    add column if not exists last_billed_date   date;

-- annual contract_value split across the periods in one year
create or replace function fn_amc_period_amount(p_value numeric, p_interval amc_billing_interval)
returns numeric language sql immutable as $$
    select round(case p_interval
        when 'monthly'   then p_value / 12.0
        when 'quarterly' then p_value / 4.0
        when 'annually'  then p_value
        else 0
    end, 2);
$$;

-- move a date forward by one billing period
create or replace function fn_amc_next_date(p_from date, p_interval amc_billing_interval)
returns date language sql immutable as $$
    select case p_interval
        when 'monthly'   then p_from + interval '1 month'
        when 'quarterly' then p_from + interval '3 months'
        when 'annually'  then p_from + interval '1 year'
        else p_from
    end::date;
$$;

-- contracts that are due to be billed today (or overdue)
create or replace view v_amc_due as
select c.id, c.contract_no, c.lab_id, l.name as lab_name,
       c.billing_interval, c.next_billing_date, c.contract_value,
       fn_amc_period_amount(c.contract_value, c.billing_interval) as period_amount,
       p.item_code as service_item, p.name as service_name,
       (current_date - c.next_billing_date) as days_overdue
from contracts c
join labs l on l.id = c.lab_id
left join products p on p.id = c.service_product_id
where c.status = 'active'
  and c.billing_interval <> 'none'
  and c.service_product_id is not null
  and c.next_billing_date is not null
  and c.next_billing_date <= current_date
order by c.next_billing_date;

-- generate one draft invoice per due contract; returns what was created.
-- Idempotent per period: the invoice_no is keyed to the period date, so a
-- second run in the same period hits the unique constraint and skips.
create or replace function fn_generate_amc_invoices()
returns table(contract_no text, invoice_no text, lab_name text, amount numeric)
language plpgsql as $$
declare
    r        record;
    v_inv    uuid;
    v_no     text;
    v_amount numeric;
begin
    for r in
        select c.*, l.name as lab_name
        from contracts c
        join labs l on l.id = c.lab_id
        where c.status = 'active'
          and c.billing_interval <> 'none'
          and c.service_product_id is not null
          and c.next_billing_date is not null
          and c.next_billing_date <= current_date
        order by c.next_billing_date
    loop
        v_amount := fn_amc_period_amount(r.contract_value, r.billing_interval);
        v_no := 'AMC-' || r.contract_no || '-' || to_char(r.next_billing_date, 'YYYYMMDD');

        -- skip if this period was already billed
        if exists (select 1 from sales_invoices s where s.invoice_no = v_no) then
            continue;
        end if;

        insert into sales_invoices (invoice_no, lab_id, posting_date, due_date, status, notes)
        values (v_no, r.lab_id, r.next_billing_date, r.next_billing_date + 15, 'draft',
                'Auto-generated AMC billing for contract ' || r.contract_no)
        returning id into v_inv;

        insert into sales_invoice_items (invoice_id, product_id, qty, rate)
        values (v_inv, r.service_product_id, 1, v_amount);  -- trigger syncs total

        update contracts
           set last_billed_date = r.next_billing_date,
               next_billing_date = fn_amc_next_date(r.next_billing_date, r.billing_interval),
               updated_at = now()
         where id = r.id;

        contract_no := r.contract_no;
        invoice_no  := v_no;
        lab_name    := r.lab_name;
        amount      := v_amount;
        return next;
    end loop;
end $$;

-- Scalar wrapper so the app can run billing and get a clean invoice count
-- back. The custom PostgREST client calls functions as `select fn() as
-- result` (scalar context), which for the table-returning function above
-- would surface only the first row — so the UI calls this instead.
create or replace function fn_run_amc_billing()
returns integer language plpgsql as $$
declare v_count integer;
begin
    select count(*) into v_count from fn_generate_amc_invoices();
    return v_count;
end $$;

-- ===== migration: 0065_audit_trail.sql =====
-- =====================================================================
-- Migration 0065 : Immutable audit trail (ported idea from Tryton)
--
-- Medical-device records (devices, maintenance, contracts, serials) and the
-- money tables (sales, invoices) must be traceable: every insert/update/delete
-- is captured with a full before/after snapshot and the changed field list.
-- The log is APPEND-ONLY — an update or delete on audit_log itself raises — so
-- history cannot be rewritten, even by whoever made the change.
--
-- "Who" is read from the `app.actor` GUC when the app sets it; the "what /
-- when / how" is captured unconditionally at the database level, so it cannot
-- be bypassed by any code path.
-- =====================================================================

create table if not exists audit_log (
    id             bigint generated always as identity primary key,
    table_name     text        not null,
    record_id      uuid,
    action         text        not null check (action in ('INSERT','UPDATE','DELETE')),
    actor          text,
    changed_at     timestamptz not null default now(),
    old_data       jsonb,
    new_data       jsonb,
    changed_fields text[]
);

create index if not exists idx_audit_record on audit_log(table_name, record_id);
create index if not exists idx_audit_time on audit_log(changed_at desc);

-- Capture a row change. SECURITY DEFINER so it can always write the log
-- regardless of the caller's privileges on audit_log.
create or replace function fn_audit() returns trigger
language plpgsql security definer as $$
declare
    v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
    v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
    v_rec uuid  := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
    v_fields text[];
begin
    if tg_op = 'UPDATE' then
        select array_agg(k order by k) into v_fields
        from jsonb_object_keys(v_new) k
        where k not in ('updated_at')
          and (v_new -> k) is distinct from (v_old -> k);
        -- a no-op update (only updated_at moved) is not worth a row
        if v_fields is null then return new; end if;
    end if;

    insert into audit_log (table_name, record_id, action, actor, old_data, new_data, changed_fields)
    values (tg_table_name, v_rec, tg_op,
            nullif(current_setting('app.actor', true), ''),
            v_old, v_new, v_fields);
    return coalesce(new, old);
end $$;

-- Make audit_log append-only.
create or replace function fn_audit_immutable() returns trigger
language plpgsql as $$
begin
    raise exception 'audit_log is append-only; % is not permitted', tg_op;
end $$;

drop trigger if exists trg_audit_immutable on audit_log;
create trigger trg_audit_immutable before update or delete on audit_log
    for each row execute function fn_audit_immutable();

-- Attach the audit trigger to the compliance- and money-critical tables.
do $$
declare t text;
begin
    foreach t in array array[
        'sales','sales_invoices','contracts','devices','maintenance_visits',
        'serial_numbers','products','labs','purchase_invoices','stock_movements'
    ]
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

-- Read access (append-only, no update/delete policy on purpose).
alter table audit_log enable row level security;
drop policy if exists "authenticated_read" on audit_log;
create policy "authenticated_read" on audit_log for select to authenticated using (true);

-- ===== migration: 0066_reorder_rules.sql =====
-- =====================================================================
-- Migration 0066 : Reordering rules (ported idea from Odoo)
--
-- When on-hand stock of a product falls below its reorder_level, it should be
-- reordered from its default supplier. v_reorder_suggestions lists what is
-- short; fn_generate_reorder_pos() raises one DRAFT purchase order per supplier
-- for the shortfall — but only for products that are not already sitting on an
-- open PO, so repeated runs never double-order.
-- =====================================================================

-- On-hand per product (from tracked kit batches) vs. its reorder level.
create or replace view v_reorder_suggestions as
with on_hand as (
    select product_id, sum(qty) as qty from v_stock_balance group by product_id
)
select
    p.id                                   as product_id,
    p.item_code,
    p.name                                 as product_name,
    p.reorder_level,
    coalesce(o.qty, 0)                     as on_hand,
    (p.reorder_level - coalesce(o.qty, 0)) as shortfall,
    p.supplier_id,
    c.name                                 as supplier_name,
    p.default_buy_price
from products p
left join on_hand o  on o.product_id = p.id
left join companies c on c.id = p.supplier_id
where p.is_disabled = false
  and p.reorder_level > 0
  and coalesce(o.qty, 0) < p.reorder_level
order by c.name nulls last, p.name;

-- Raise draft POs (one per supplier) for everything currently short that is not
-- already on an open (draft/submitted) PO. Returns the number of POs created.
create or replace function fn_generate_reorder_pos()
returns integer language plpgsql as $$
declare
    v_sup   uuid;
    v_po    uuid;
    v_no    text;
    v_count int := 0;
    v_lines int;
begin
    for v_sup in
        select distinct supplier_id
        from v_reorder_suggestions
        where supplier_id is not null
    loop
        -- how many still-needed lines does this supplier have?
        select count(*) into v_lines
        from v_reorder_suggestions s
        where s.supplier_id = v_sup
          and not exists (
              select 1 from purchase_order_items poi
              join purchase_orders po on po.id = poi.po_id
              where poi.product_id = s.product_id and po.status in ('draft','submitted'));
        if v_lines = 0 then continue; end if;

        v_no := 'PO-RE-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(v_sup::text, 1, 4);
        insert into purchase_orders (po_no, supplier_id, status, notes)
        values (v_no, v_sup, 'draft', 'Auto-generated from reorder rules')
        returning id into v_po;

        insert into purchase_order_items (po_id, product_id, qty, rate)
        select v_po, s.product_id, s.shortfall, s.default_buy_price
        from v_reorder_suggestions s
        where s.supplier_id = v_sup
          and not exists (
              select 1 from purchase_order_items poi
              join purchase_orders po on po.id = poi.po_id
              where poi.product_id = s.product_id and po.status in ('draft','submitted'));

        v_count := v_count + 1;
    end loop;
    return v_count;
end $$;

-- ===== migration: 0067_maintenance_forecast.sql =====
-- =====================================================================
-- Migration 0067 : Predictive maintenance forecast
--
-- A wider-horizon companion to v_maintenance_alerts: every device that needs
-- maintenance and is overdue or due within the next 90 days, bucketed by
-- urgency and enriched with the date of its last recorded visit at the lab, so
-- a device can be serviced before it fails.
-- =====================================================================

create or replace view v_maintenance_forecast as
with last_visit as (
    select lab_id, max(visit_date) as last_visit_date
    from maintenance_visits
    where status <> 'cancelled'
    group by lab_id
)
select
    d.id,
    d.asset_code,
    d.serial_no,
    p.name                              as product_name,
    l.name                              as lab_name,
    d.status,
    d.next_maintenance_date,
    (d.next_maintenance_date - current_date) as days_until_due,
    case
        when d.next_maintenance_date <  current_date               then 'overdue'
        when d.next_maintenance_date <= current_date + 7           then 'due_this_week'
        when d.next_maintenance_date <= current_date + 30          then 'due_this_month'
        else 'upcoming'
    end                                 as urgency,
    lv.last_visit_date
from devices d
join products p on p.id = d.product_id
left join labs l on l.id = d.lab_id
left join last_visit lv on lv.lab_id = d.lab_id
where d.maintenance_required = true
  and d.next_maintenance_date is not null
  and d.next_maintenance_date <= current_date + 90
order by d.next_maintenance_date;

-- ===== migration: 0068_landed_costs.sql =====
-- =====================================================================
-- Migration 0068 : Landed cost vouchers (ported idea from Metasfresh)
--
-- Imported goods carry costs beyond the supplier price — freight, customs,
-- clearance. A landed-cost voucher spreads those extras across the kit batches
-- created by a purchase receipt (by value or by quantity), raising each batch's
-- true unit cost so profit margins reflect the REAL cost of goods, not just the
-- invoice price.
-- =====================================================================

do $$ begin
    create type landed_alloc_method as enum ('by_value','by_qty');
exception when duplicate_object then null; end $$;
do $$ begin
    create type landed_cost_status as enum ('draft','applied');
exception when duplicate_object then null; end $$;

create table if not exists landed_cost_vouchers (
    id                uuid primary key default gen_random_uuid(),
    voucher_no        text not null unique,
    receipt_id        uuid not null references purchase_receipts(id) on delete cascade,
    freight           numeric(14,2) not null default 0,
    customs           numeric(14,2) not null default 0,
    clearance         numeric(14,2) not null default 0,
    other             numeric(14,2) not null default 0,
    total_extra       numeric(14,2) generated always as (freight + customs + clearance + other) stored,
    allocation_method landed_alloc_method not null default 'by_value',
    status            landed_cost_status not null default 'draft',
    notes             text,
    created_at        timestamptz not null default now(),
    applied_at        timestamptz
);

create index if not exists idx_landed_receipt on landed_cost_vouchers(receipt_id);

-- Spread the voucher's extra cost across the receipt's kit batches and bump
-- each batch's buy_price by its per-unit share. Idempotent: only a draft
-- voucher against a received receipt is applied, and it flips to 'applied'.
create or replace function fn_apply_landed_cost(p_voucher_id uuid)
returns numeric language plpgsql as $$
declare
    v_v      landed_cost_vouchers%rowtype;
    v_rcpt   purchase_receipts%rowtype;
    v_base   numeric;
    v_row    record;
    v_share  numeric;
    v_batch  text;
begin
    select * into v_v from landed_cost_vouchers where id = p_voucher_id for update;
    if not found then raise exception 'Landed cost voucher % not found', p_voucher_id; end if;
    if v_v.status = 'applied' then raise exception 'Voucher % is already applied', v_v.voucher_no; end if;

    select * into v_rcpt from purchase_receipts where id = v_v.receipt_id;
    if v_rcpt.status <> 'received' then
        raise exception 'Receipt % must be received before landed costs can be applied', v_rcpt.receipt_no;
    end if;
    if v_v.total_extra <= 0 then raise exception 'Voucher % has no extra cost to allocate', v_v.voucher_no; end if;

    -- allocation base over kit items only (those that produced stock batches)
    select sum(case when v_v.allocation_method = 'by_qty' then ri.qty else ri.qty * ri.rate end)
      into v_base
    from purchase_receipt_items ri
    join products p on p.id = ri.product_id
    where ri.receipt_id = v_v.receipt_id and p.product_type = 'kit';

    if coalesce(v_base, 0) = 0 then raise exception 'Receipt % has no stockable items to allocate onto', v_rcpt.receipt_no; end if;

    for v_row in
        select ri.*, (case when v_v.allocation_method = 'by_qty' then ri.qty else ri.qty * ri.rate end) as weight
        from purchase_receipt_items ri
        join products p on p.id = ri.product_id
        where ri.receipt_id = v_v.receipt_id and p.product_type = 'kit'
    loop
        v_share := v_v.total_extra * (v_row.weight / v_base);   -- extra cost for this line
        v_batch := coalesce(v_row.batch_no, 'PR-' || v_rcpt.receipt_no || '-' || left(v_row.id::text, 8));
        update kit_batches
           set buy_price = buy_price + (v_share / nullif(v_row.qty, 0))
         where product_id = v_row.product_id and batch_no = v_batch;
    end loop;

    update landed_cost_vouchers set status = 'applied', applied_at = now() where id = p_voucher_id;
    return v_v.total_extra;
end $$;

alter table landed_cost_vouchers enable row level security;
drop policy if exists "authenticated_all" on landed_cost_vouchers;
create policy "authenticated_all" on landed_cost_vouchers for all to authenticated using (true) with check (true);

-- ===== migration: 0069_warranty_billing.sql =====
-- =====================================================================
-- Migration 0069 : Warranty billing party (ported idea from Tryton)
--
-- A warranty/AMC repair is paid by someone: the agent (us — covered under
-- warranty, a cost to the business), the hospital (out-of-warranty, billable),
-- or an insurer (billable to a third party). Recording who bears each claim's
-- charge lets the business see its warranty cost vs. its receivables.
-- =====================================================================

do $$ begin
    create type warranty_bill_party as enum ('agent','hospital','insurance');
exception when duplicate_object then null; end $$;

alter table warranty_claims
    add column if not exists billed_to     warranty_bill_party not null default 'agent',
    add column if not exists charge_amount numeric(14,2) not null default 0,
    add column if not exists insurer_name  text;

-- Totals by who pays: agent charges are cost to us, hospital/insurance are
-- receivables. Only claims that are not cancelled count.
create or replace view v_warranty_billing as
select
    billed_to,
    count(*)                as claims,
    coalesce(sum(charge_amount), 0) as total_charge
from warranty_claims
where status <> 'cancelled'
group by billed_to;

-- ===== migration: 0070_customer_portal.sql =====
-- =====================================================================
-- Migration 0070 : Customer portal (ported idea from Odoo)
--
-- Hospitals get a heavily-restricted login (role 'customer') bound to their
-- lab. A portal user can only ever see their OWN lab's devices and maintenance
-- history and open fault tickets — enforced server-side from the session, never
-- from client input.
-- =====================================================================

-- New restricted role. ADD VALUE must be its own statement (a new enum label
-- cannot be *used* in the same transaction it is created, but the runtime
-- function bodies below only reference it when they execute, after commit).
alter type app_user_role add value if not exists 'customer';

-- Bind a user to a lab (only meaningful for the 'customer' role).
alter table app_users add column if not exists lab_id uuid references labs(id) on delete set null;

-- Login now also returns the bound lab so the session can carry it. The return
-- shape changes, so the old function must be dropped first.
drop function if exists fn_verify_login(text, text);
create or replace function fn_verify_login(p_email text, p_password text)
returns table(id uuid, email text, full_name text, role app_user_role, lab_id uuid)
language sql as $$
    select u.id, u.email, u.full_name, u.role, u.lab_id
    from app_users u
    where lower(u.email) = lower(p_email)
      and u.is_active
      and u.password_hash = crypt(p_password, u.password_hash);
$$;

-- Create a portal (customer) user bound to a specific lab.
create or replace function fn_create_portal_user(p_email text, p_password text, p_full_name text, p_lab_id uuid)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
    insert into app_users (email, password_hash, full_name, role, lab_id)
    values (lower(p_email), crypt(p_password, gen_salt('bf')), p_full_name, 'customer', p_lab_id)
    on conflict (email) do update set lab_id = excluded.lab_id, role = 'customer'
    returning id into v_id;
    return v_id;
end $$;

-- ===== migration: 0071_sales_order_serial.sql =====
-- =====================================================================
-- Migration 0071 : Serial number on sales-order lines
--
-- Medical-device orders often commit a specific unit, so allow an optional
-- serial number per sales-order line.
-- =====================================================================

alter table sales_order_items add column if not exists serial_no text;

-- ===== migration: 0072_feature_settings.sql =====
-- =====================================================================
-- Migration 0072 : Feature settings & per-account access
-- =====================================================================

create table if not exists feature_flags (
    feature    text primary key,
    state      text not null default 'enabled' check (state in ('enabled','disabled','hidden')),
    updated_at timestamptz not null default now()
);

create table if not exists user_feature_access (
    user_id    uuid not null references app_users(id) on delete cascade,
    feature    text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, feature)
);

create index if not exists idx_user_feature_access_user on user_feature_access(user_id);

alter table feature_flags enable row level security;
alter table user_feature_access enable row level security;
drop policy if exists "authenticated_all" on feature_flags;
drop policy if exists "authenticated_all" on user_feature_access;
create policy "authenticated_all" on feature_flags for all to authenticated using (true) with check (true);
create policy "authenticated_all" on user_feature_access for all to authenticated using (true) with check (true);

-- ===== migration: 0073_pos_idempotency.sql =====
-- =====================================================================
-- Migration 0073 : Idempotent POS checkout (offline-safe sales)
-- =====================================================================

create table if not exists idempotency_keys (
    key        uuid primary key,
    result     jsonb not null,
    created_at timestamptz not null default now()
);

alter table idempotency_keys enable row level security;
drop policy if exists "authenticated_all" on idempotency_keys;
create policy "authenticated_all" on idempotency_keys for all to authenticated using (true) with check (true);

create or replace function fn_pos_checkout(p_request_id uuid, p_lab_id uuid, p_lines text)
returns table(n_lines int, total_amount numeric)
language plpgsql as $$
declare
    v_result jsonb;
    it        jsonb;
    v_pid     uuid;
    v_qty     numeric;
    v_sell    numeric;
    v_buy     numeric;
    v_disabled boolean;
    v_count   int := 0;
    v_total   numeric := 0;
begin
    if p_request_id is null then raise exception 'Missing request id'; end if;

    select result into v_result from idempotency_keys where key = p_request_id;
    if found then
        return query select (v_result->>'n_lines')::int, (v_result->>'total_amount')::numeric;
        return;
    end if;

    if p_lab_id is null then raise exception 'Select a customer (lab).'; end if;
    perform 1 from labs where id = p_lab_id;
    if not found then raise exception 'Customer not found.'; end if;

    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        v_pid  := (it->>'product_id')::uuid;
        v_qty  := (it->>'qty')::numeric;
        v_sell := (it->>'sell_price')::numeric;
        if v_pid is null then raise exception 'A product in the cart is invalid.'; end if;
        if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
        if v_sell is null or v_sell < 0 then raise exception 'Sell price cannot be negative.'; end if;

        select default_buy_price, is_disabled into v_buy, v_disabled from products where id = v_pid;
        if not found then raise exception 'A product in the cart no longer exists.'; end if;
        if v_disabled then raise exception 'A product in the cart is disabled.'; end if;

        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (p_lab_id, v_pid, v_qty, coalesce(v_buy, 0), v_sell);
        v_count := v_count + 1;
        v_total := v_total + v_qty * v_sell;
    end loop;

    if v_count = 0 then raise exception 'Cart is empty.'; end if;

    v_result := jsonb_build_object('n_lines', v_count, 'total_amount', v_total);
    insert into idempotency_keys (key, result) values (p_request_id, v_result);

    return query select v_count, v_total;
end; $$;

-- ===== migration: 0074_monitoring.sql =====
-- =====================================================================
-- Migration 0074 : Monitoring (errors, connectivity & sync health)
-- =====================================================================

create table if not exists app_errors (
    id          bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    severity    text not null default 'error' check (severity in ('error','warning')),
    source      text not null default 'client' check (source in ('client','server')),
    message     text not null,
    detail      text,
    path        text,
    user_email  text,
    resolved    boolean not null default false
);
create index if not exists idx_app_errors_time on app_errors(occurred_at desc);
create index if not exists idx_app_errors_open on app_errors(resolved, occurred_at desc);

create table if not exists connectivity_events (
    id               bigint generated always as identity primary key,
    user_email       text,
    went_offline_at  timestamptz not null,
    came_online_at   timestamptz not null,
    duration_seconds numeric not null,
    created_at       timestamptz not null default now()
);
create index if not exists idx_connectivity_time on connectivity_events(came_online_at desc);

create table if not exists sync_events (
    id         bigint generated always as identity primary key,
    synced_at  timestamptz not null default now(),
    user_email text,
    item_count int not null default 0,
    ok         boolean not null default true,
    detail     text
);
create index if not exists idx_sync_time on sync_events(synced_at desc);

alter table app_errors enable row level security;
alter table connectivity_events enable row level security;
alter table sync_events enable row level security;
drop policy if exists "authenticated_all" on app_errors;
drop policy if exists "authenticated_all" on connectivity_events;
drop policy if exists "authenticated_all" on sync_events;
create policy "authenticated_all" on app_errors for all to authenticated using (true) with check (true);
create policy "authenticated_all" on connectivity_events for all to authenticated using (true) with check (true);
create policy "authenticated_all" on sync_events for all to authenticated using (true) with check (true);

-- ===== migration: 0075_audit_orders.sql =====
-- =====================================================================
-- Migration 0075 : Audit sales & purchase orders
-- =====================================================================
do $$
declare t text;
begin
    foreach t in array array[
        'sales_orders','sales_order_items','purchase_orders','purchase_order_items'
    ]
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

-- ===== migration: 0076_sale_stock_deduction.sql =====
-- =====================================================================
-- Migration 0076 : Deduct stock on sale + prevent overselling
-- =====================================================================
create or replace function fn_consume_product_stock(p_product_id uuid, p_qty numeric)
returns void language plpgsql as $$
declare
    v_type text; v_name text; v_avail numeric; v_remaining numeric := p_qty; v_take numeric; b record;
begin
    select product_type, name into v_type, v_name from products where id = p_product_id;
    if v_type is distinct from 'kit' then return; end if;
    select coalesce(sum(qty_available), 0) into v_avail
      from kit_batches where product_id = p_product_id and qty_available > 0;
    if v_avail < p_qty then
        raise exception 'Insufficient stock for %: % available, % needed',
            coalesce(v_name, 'product'), v_avail, p_qty using errcode = 'check_violation';
    end if;
    for b in select id, qty_available from kit_batches
             where product_id = p_product_id and qty_available > 0
             order by expiry_date nulls last, created_at for update
    loop
        exit when v_remaining <= 0;
        v_take := least(b.qty_available, v_remaining);
        update kit_batches set qty_available = qty_available - v_take, updated_at = now() where id = b.id;
        v_remaining := v_remaining - v_take;
    end loop;
end; $$;

create or replace function fn_pos_checkout(p_request_id uuid, p_lab_id uuid, p_lines text)
returns table(n_lines int, total_amount numeric)
language plpgsql as $$
declare
    v_result jsonb; it jsonb; v_pid uuid; v_qty numeric; v_sell numeric; v_buy numeric;
    v_disabled boolean; v_count int := 0; v_total numeric := 0;
begin
    if p_request_id is null then raise exception 'Missing request id'; end if;
    select result into v_result from idempotency_keys where key = p_request_id;
    if found then
        return query select (v_result->>'n_lines')::int, (v_result->>'total_amount')::numeric;
        return;
    end if;
    if p_lab_id is null then raise exception 'Select a customer (lab).'; end if;
    perform 1 from labs where id = p_lab_id;
    if not found then raise exception 'Customer not found.'; end if;
    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        v_pid  := (it->>'product_id')::uuid;
        v_qty  := (it->>'qty')::numeric;
        v_sell := (it->>'sell_price')::numeric;
        if v_pid is null then raise exception 'A product in the cart is invalid.'; end if;
        if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
        if v_sell is null or v_sell < 0 then raise exception 'Sell price cannot be negative.'; end if;
        select default_buy_price, is_disabled into v_buy, v_disabled from products where id = v_pid;
        if not found then raise exception 'A product in the cart no longer exists.'; end if;
        if v_disabled then raise exception 'A product in the cart is disabled.'; end if;
        perform fn_consume_product_stock(v_pid, v_qty);
        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (p_lab_id, v_pid, v_qty, coalesce(v_buy, 0), v_sell);
        v_count := v_count + 1;
        v_total := v_total + v_qty * v_sell;
    end loop;
    if v_count = 0 then raise exception 'Cart is empty.'; end if;
    v_result := jsonb_build_object('n_lines', v_count, 'total_amount', v_total);
    insert into idempotency_keys (key, result) values (p_request_id, v_result);
    return query select v_count, v_total;
end; $$;

create or replace function fn_deliver_sales_order(p_so_id uuid)
returns int language plpgsql as $$
declare v_status so_status; v_lab uuid; it record; v_buy numeric; n int := 0;
begin
    select status, lab_id into v_status, v_lab from sales_orders where id = p_so_id;
    if not found then raise exception 'Sales order not found'; end if;
    if v_status = 'delivered' then raise exception 'Sales order already delivered'; end if;
    if v_status = 'cancelled' then raise exception 'Sales order is cancelled'; end if;
    for it in select * from sales_order_items where sales_order_id = p_so_id loop
        select default_buy_price into v_buy from products where id = it.product_id;
        perform fn_consume_product_stock(it.product_id, it.qty);
        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (v_lab, it.product_id, it.qty, coalesce(v_buy, 0), it.rate);
        n := n + 1;
    end loop;
    update sales_orders set status = 'delivered', delivered_at = now(), updated_at = now() where id = p_so_id;
    return n;
end; $$;

-- ===== migration: 0077_auto_gl_posting.sql =====
-- =====================================================================
-- Migration 0077 : Automatic GL (double-entry) posting from sales & purchases
--
-- Until now `sales` and `purchase_invoices` recorded money but nothing posted
-- to the general ledger (journal_entries), so the books never reflected trade.
--
-- Now each sale posts a balanced, posted journal entry:
--     Dr Accounts Receivable   Cr Sales            (revenue = qty * sell_price)
--     Dr Cost of Goods Sold    Cr Stock In Hand    (cost    = qty * buy_price)
-- and each purchase invoice posts:
--     Dr Stock In Hand         Cr Accounts Payable (total_amount)
--
-- Accounts are resolved from the chart of accounts by type/root (not hardcoded
-- ids). Both posting functions are DEFENSIVE: any error (e.g. the chart isn't
-- set up) is swallowed with a warning, so a GL problem can NEVER break a sale
-- or a purchase. Purchase posting is guarded by gl_posted_at so it posts once.
-- =====================================================================

-- ---- Sales → GL -----------------------------------------------------------
create or replace function fn_post_sale_gl(p_sale_id uuid)
returns void language plpgsql as $$
declare
    v_lab uuid; v_qty numeric; v_buy numeric; v_sell numeric; v_date date;
    v_sell_amt numeric; v_cost_amt numeric;
    v_ar text; v_income text; v_cogs text; v_stock text;
    v_je uuid; v_lines int := 0;
begin
    select lab_id, qty, buy_price, sell_price, sold_at::date
      into v_lab, v_qty, v_buy, v_sell, v_date
      from sales where id = p_sale_id;
    if not found then return; end if;

    v_sell_amt := round(coalesce(v_qty, 0) * coalesce(v_sell, 0), 2);
    v_cost_amt := round(coalesce(v_qty, 0) * coalesce(v_buy, 0), 2);

    select account_name into v_ar     from accounts where account_type = 'Receivable'         and not is_group and not disabled order by account_number limit 1;
    select account_name into v_income from accounts where root_type = 'income'                and not is_group and not disabled order by account_number limit 1;
    select account_name into v_cogs   from accounts where account_type = 'Cost of Goods Sold' and not is_group and not disabled order by account_number limit 1;
    select account_name into v_stock  from accounts where account_type = 'Stock'              and not is_group and not disabled order by account_number limit 1;

    insert into journal_entries (voucher_type, posting_date, user_remark)
      values ('Sales Invoice', coalesce(v_date, current_date), 'Auto GL for sale ' || p_sale_id)
      returning id into v_je;

    if v_ar is not null and v_income is not null and v_sell_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit, party_type, party_lab_id)
          values (v_je, v_ar, v_sell_amt, 0, 'lab', v_lab);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit)
          values (v_je, v_income, 0, v_sell_amt);
        v_lines := v_lines + 2;
    end if;
    if v_cogs is not null and v_stock is not null and v_cost_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_cogs, v_cost_amt, 0);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_stock, 0, v_cost_amt);
        v_lines := v_lines + 2;
    end if;

    if v_lines = 0 then
        delete from journal_entries where id = v_je;
        return;
    end if;
    perform fn_post_journal_entry(v_je);
exception when others then
    raise warning 'Auto GL for sale % skipped: %', p_sale_id, sqlerrm;
    return;
end; $$;

create or replace function trg_sale_gl() returns trigger language plpgsql as $$
begin
    perform fn_post_sale_gl(new.id);
    return new;
end; $$;

drop trigger if exists t_sale_gl on sales;
create trigger t_sale_gl after insert on sales for each row execute function trg_sale_gl();

-- ---- Purchase invoice → GL ------------------------------------------------
alter table purchase_invoices add column if not exists gl_posted_at timestamptz;

create or replace function fn_post_purchase_gl(p_pi_id uuid)
returns void language plpgsql as $$
declare
    v_supplier uuid; v_total numeric; v_date date; v_posted timestamptz;
    v_stock text; v_payable text; v_je uuid;
begin
    select supplier_id, total_amount, posting_date, gl_posted_at
      into v_supplier, v_total, v_date, v_posted
      from purchase_invoices where id = p_pi_id;
    if not found then return; end if;
    if v_posted is not null then return; end if;               -- already posted
    if coalesce(v_total, 0) <= 0 then return; end if;          -- nothing to post yet

    select account_name into v_stock   from accounts where account_type = 'Stock'   and not is_group and not disabled order by account_number limit 1;
    select account_name into v_payable from accounts where account_type = 'Payable' and not is_group and not disabled order by account_number limit 1;
    if v_stock is null or v_payable is null then return; end if;

    insert into journal_entries (voucher_type, posting_date, user_remark)
      values ('Purchase Invoice', coalesce(v_date, current_date), 'Auto GL for purchase ' || p_pi_id)
      returning id into v_je;
    insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_stock, v_total, 0);
    insert into journal_entry_accounts (journal_entry_id, account, debit, credit, party_type, party_company_id)
      values (v_je, v_payable, 0, v_total, 'company', v_supplier);
    perform fn_post_journal_entry(v_je);

    update purchase_invoices set gl_posted_at = now() where id = p_pi_id;
exception when others then
    raise warning 'Auto GL for purchase % skipped: %', p_pi_id, sqlerrm;
    return;
end; $$;

create or replace function trg_purchase_gl() returns trigger language plpgsql as $$
begin
    perform fn_post_purchase_gl(new.id);
    return new;
end; $$;

drop trigger if exists t_purchase_gl on purchase_invoices;
create trigger t_purchase_gl after insert or update on purchase_invoices for each row execute function trg_purchase_gl();

-- ===== migration: 0078_sales_order_idempotent.sql =====
-- =====================================================================
-- Migration 0078 : Idempotent sales-order creation (offline-safe)
--
-- Sales orders can now be created from the offline outbox and replayed when the
-- network returns, so a replay must never create a duplicate order. Each create
-- carries a client-generated request id; fn_save_sales_order books the order
-- (header + lines) in a single transaction and, on a replay with the same id,
-- just returns the existing order id and changes nothing.
-- =====================================================================

alter table sales_orders add column if not exists client_request_id uuid;
create unique index if not exists idx_so_client_request
    on sales_orders(client_request_id) where client_request_id is not null;

-- p_lines is a JSON array of { product_id, qty, rate, serial_no }.
create or replace function fn_save_sales_order(
    p_request_id uuid,
    p_lab_id uuid,
    p_transaction_date text,
    p_delivery_date text,
    p_notes text,
    p_lines text
) returns uuid language plpgsql as $$
declare
    v_id  uuid;
    it    jsonb;
    n     int := 0;
begin
    if p_lab_id is null then raise exception 'Pick a lab'; end if;

    -- Already booked under this request id? Return it, unchanged.
    if p_request_id is not null then
        select id into v_id from sales_orders where client_request_id = p_request_id;
        if found then return v_id; end if;
    end if;

    insert into sales_orders (lab_id, transaction_date, delivery_date, notes, client_request_id)
    values (
        p_lab_id,
        coalesce(nullif(p_transaction_date, '')::date, current_date),
        nullif(p_delivery_date, '')::date,
        nullif(p_notes, ''),
        p_request_id
    )
    returning id into v_id;

    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        if coalesce(it->>'product_id', '') = '' then continue; end if;
        if coalesce((it->>'qty')::numeric, 0) <= 0 then continue; end if;
        insert into sales_order_items (sales_order_id, product_id, qty, rate, serial_no)
        values (
            v_id,
            (it->>'product_id')::uuid,
            (it->>'qty')::numeric,
            coalesce((it->>'rate')::numeric, 0),
            nullif(trim(it->>'serial_no'), '')
        );
        n := n + 1;
    end loop;

    if n = 0 then raise exception 'Add at least one line'; end if;
    return v_id;
end; $$;

-- ===== migration: 0079_audit_financial_docs.sql =====
do $$
declare t text;
begin
    foreach t in array array[
        'sales_invoice_items',
        'sales_invoice_payments',
        'quotations',
        'quotation_items',
        'delivery_notes',
        'delivery_note_items',
        'purchase_items',
        'purchase_receipts',
        'purchase_receipt_items',
        'supplier_quotations',
        'supplier_quotation_items'
    ]
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

-- ===== migration: 0080_sales_returns.sql =====
-- =====================================================================
-- Migration 0080 : Sales Returns (credit notes)
--
-- A lab can return kits/devices. A return is the mirror of a sale, so it is
-- booked additively — it never touches the original sale row:
--   * kit stock is put BACK (a new "returned goods" batch is created);
--   * a REVERSING journal entry is posted, the exact opposite of fn_post_sale_gl:
--         Dr Sales (income)        Cr Accounts Receivable   (revenue reversed)
--         Dr Stock In Hand         Cr Cost of Goods Sold    (cost back to stock)
--   * every change is captured by the immutable audit trail.
--
-- Booking is idempotent on a client_request_id (an offline/replayed submit can
-- never double-refund or double-restock). GL posting is DEFENSIVE — a chart-of-
-- accounts problem raises a warning, never breaks the return. The profit summary
-- is recreated to report figures NET of submitted returns.
-- =====================================================================

do $$ begin
    create type sales_return_status as enum ('submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sales_returns (
    id                uuid primary key default gen_random_uuid(),
    return_no         text unique,
    client_request_id uuid unique,                 -- idempotency for offline replays
    lab_id            uuid not null references labs(id) on delete restrict,
    posting_date      date not null default current_date,
    status            sales_return_status not null default 'submitted',
    reason            text,
    notes             text,
    total_amount      numeric(14,2) not null default 0,   -- synced from items
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_sret_lab on sales_returns(lab_id);
create index if not exists idx_sret_date on sales_returns(posting_date);

create table if not exists sales_return_items (
    id          uuid primary key default gen_random_uuid(),
    return_id   uuid not null references sales_returns(id) on delete cascade,
    product_id  uuid not null references products(id) on delete restrict,
    qty         numeric(14,2) not null check (qty > 0),
    buy_price   numeric(14,2) not null default 0,
    sell_price  numeric(14,2) not null default 0,
    amount      numeric(14,2) generated always as (qty * sell_price) stored,
    created_at  timestamptz not null default now()
);

create index if not exists idx_sretitems_ret on sales_return_items(return_id);

-- keep sales_returns.total_amount = sum of item amounts
create or replace function fn_sync_return_total() returns trigger
language plpgsql as $$
declare v_ret uuid;
begin
    v_ret := coalesce(new.return_id, old.return_id);
    update sales_returns set
        total_amount = coalesce((select sum(amount) from sales_return_items where return_id = v_ret), 0),
        updated_at = now()
    where id = v_ret;
    return null;
end $$;

drop trigger if exists trg_sync_return_total on sales_return_items;
create trigger trg_sync_return_total
    after insert or update or delete on sales_return_items
    for each row execute function fn_sync_return_total();

-- Reversing GL for a return — the exact opposite of fn_post_sale_gl.
create or replace function fn_post_return_gl(p_return_id uuid)
returns void language plpgsql as $$
declare
    v_lab uuid; v_date date; v_sell_amt numeric; v_cost_amt numeric;
    v_ar text; v_income text; v_cogs text; v_stock text;
    v_je uuid; v_lines int := 0;
begin
    select lab_id, posting_date into v_lab, v_date from sales_returns where id = p_return_id;
    if not found then return; end if;

    select coalesce(sum(qty * sell_price), 0), coalesce(sum(qty * buy_price), 0)
      into v_sell_amt, v_cost_amt
      from sales_return_items where return_id = p_return_id;
    v_sell_amt := round(v_sell_amt, 2);
    v_cost_amt := round(v_cost_amt, 2);

    select account_name into v_ar     from accounts where account_type = 'Receivable'         and not is_group and not disabled order by account_number limit 1;
    select account_name into v_income from accounts where root_type = 'income'                and not is_group and not disabled order by account_number limit 1;
    select account_name into v_cogs   from accounts where account_type = 'Cost of Goods Sold' and not is_group and not disabled order by account_number limit 1;
    select account_name into v_stock  from accounts where account_type = 'Stock'              and not is_group and not disabled order by account_number limit 1;

    insert into journal_entries (voucher_type, posting_date, user_remark)
      values ('Sales Invoice', coalesce(v_date, current_date), 'Auto GL for sales return ' || p_return_id)
      returning id into v_je;

    -- Revenue reversed: Dr Sales / Cr Accounts Receivable.
    if v_ar is not null and v_income is not null and v_sell_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit)
          values (v_je, v_income, v_sell_amt, 0);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit, party_type, party_lab_id)
          values (v_je, v_ar, 0, v_sell_amt, 'lab', v_lab);
        v_lines := v_lines + 2;
    end if;
    -- Cost returned to stock: Dr Stock In Hand / Cr Cost of Goods Sold.
    if v_cogs is not null and v_stock is not null and v_cost_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_stock, v_cost_amt, 0);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_cogs, 0, v_cost_amt);
        v_lines := v_lines + 2;
    end if;

    if v_lines = 0 then
        delete from journal_entries where id = v_je;
        return;
    end if;
    perform fn_post_journal_entry(v_je);
exception when others then
    raise warning 'Auto GL for sales return % skipped: %', p_return_id, sqlerrm;
    return;
end $$;

-- Book a return atomically and idempotently: header + items, restock kits,
-- post the reversing GL. Returns the return id (existing one on replay).
-- p_lines is a JSON array of { product_id, qty, sell_price }.
create or replace function fn_book_sales_return(
    p_request_id uuid,
    p_lab_id uuid,
    p_posting_date text,
    p_reason text,
    p_notes text,
    p_lines text
) returns uuid language plpgsql as $$
declare
    v_id uuid; it jsonb; n int := 0;
    v_pid uuid; v_qty numeric; v_sell numeric; v_buy numeric; v_type text; v_no text;
    v_sold numeric; v_returned numeric; v_name text;
begin
    if p_request_id is not null then
        select id into v_id from sales_returns where client_request_id = p_request_id;
        if found then return v_id; end if;   -- idempotent replay
    end if;
    if p_lab_id is null then raise exception 'Pick a lab'; end if;

    v_no := 'RET-' || to_char(now(), 'YYMM') || '-' || substr(gen_random_uuid()::text, 1, 6);
    insert into sales_returns (return_no, client_request_id, lab_id, posting_date, reason, notes)
    values (v_no, p_request_id, p_lab_id,
            coalesce(nullif(p_posting_date, ''), current_date::text)::date,
            nullif(p_reason, ''), nullif(p_notes, ''))
    returning id into v_id;

    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        if coalesce(it->>'product_id', '') = '' then continue; end if;
        v_qty := coalesce((it->>'qty')::numeric, 0);
        if v_qty <= 0 then continue; end if;
        v_pid := (it->>'product_id')::uuid;
        v_sell := coalesce((it->>'sell_price')::numeric, 0);
        select product_type, coalesce(default_buy_price, 0) into v_type, v_buy from products where id = v_pid;

        -- Guard: never credit/restock more than the lab actually bought and
        -- still holds un-returned.
        select coalesce(sum(qty), 0) into v_sold
          from sales where lab_id = p_lab_id and product_id = v_pid;
        select coalesce(sum(ri.qty), 0) into v_returned
          from sales_return_items ri
          join sales_returns sr on sr.id = ri.return_id
          where sr.lab_id = p_lab_id and ri.product_id = v_pid and sr.status = 'submitted';
        if v_qty > v_sold - v_returned then
            select name into v_name from products where id = v_pid;
            raise exception 'Cannot return more than sold for %: sold %, already returned %, tried to return %',
                coalesce(v_name, v_pid::text), v_sold, v_returned, v_qty
                using errcode = 'check_violation';
        end if;

        insert into sales_return_items (return_id, product_id, qty, buy_price, sell_price)
        values (v_id, v_pid, v_qty, coalesce(v_buy, 0), v_sell);

        -- Put kit stock back as a dedicated returned-goods batch — one per line.
        if v_type = 'kit' then
            insert into kit_batches (batch_no, product_id, qty_received, qty_available, buy_price, sell_price)
            values (v_no || '-L' || (n + 1), v_pid, v_qty, v_qty, coalesce(v_buy, 0), v_sell);
        end if;
        n := n + 1;
    end loop;

    if n = 0 then raise exception 'Add at least one line'; end if;

    perform fn_post_return_gl(v_id);
    return v_id;
end $$;

-- Report profit/revenue/cost NET of submitted returns (a return reverses a sale).
create or replace view v_profit_summary as
with s as (
    select coalesce(sum(profit), 0) p, coalesce(sum(sell_price * qty), 0) rev,
           coalesce(sum(buy_price * qty), 0) cost, count(*) n
    from sales
), r as (
    select coalesce(sum(ri.sell_price * ri.qty), 0) rev,
           coalesce(sum(ri.buy_price * ri.qty), 0) cost
    from sales_return_items ri
    join sales_returns sr on sr.id = ri.return_id
    where sr.status = 'submitted'
)
select
    (s.p - (r.rev - r.cost))  as total_profit,
    (s.rev - r.rev)           as total_revenue,
    (s.cost - r.cost)         as total_cost,
    s.n                       as sales_count
from s, r;

-- Audit the returns like every other money document.
do $$
declare t text;
begin
    foreach t in array array['sales_returns','sales_return_items']
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

do $$
declare t text;
begin
    foreach t in array array['sales_returns','sales_return_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;

-- ===== seed data (demo) =====
-- =====================================================================
-- Seed data for local development / demo
-- Run after migrations 0001-0005.
-- =====================================================================

-- Companies -----------------------------------------------------------
insert into companies (id, name, role, country) values
    ('00000000-0000-0000-0000-0000000000a1', 'Roche Diagnostics', 'parent',   'Switzerland'),
    ('00000000-0000-0000-0000-0000000000a2', 'Siemens Healthineers', 'supplier', 'Germany')
on conflict do nothing;

-- Warehouses ----------------------------------------------------------
insert into warehouses (id, name, city) values
    ('00000000-0000-0000-0000-0000000000b1', 'Main Store - Baghdad', 'Baghdad'),
    ('00000000-0000-0000-0000-0000000000b2', 'Cold Store - Basra',   'Basra')
on conflict do nothing;

-- Labs ----------------------------------------------------------------
insert into labs (id, code, name, status, city, latitude, longitude, contact_name, phone) values
    ('00000000-0000-0000-0000-0000000000c1', 'LAB-001', 'Al-Kindy Teaching Lab', 'active',   'Baghdad', 33.3152, 44.3661, 'Dr. Sara', '0770-000-0001'),
    ('00000000-0000-0000-0000-0000000000c2', 'LAB-002', 'Basra Central Lab',     'active',   'Basra',   30.5085, 47.7835, 'Dr. Omar', '0770-000-0002'),
    ('00000000-0000-0000-0000-0000000000c3', 'LAB-003', 'Mosul Private Lab',     'inactive', 'Mosul',   36.3350, 43.1189, 'Dr. Layla','0770-000-0003')
on conflict do nothing;

-- Products ------------------------------------------------------------
insert into products (id, item_code, name, product_type, brand, uom, supplier_id, shelf_life_in_days, default_buy_price, default_sell_price) values
    ('00000000-0000-0000-0000-0000000000d1', 'DEV-CHEM-01', 'Cobas c311 Chemistry Analyzer', 'device',     'Roche',   'Nos', '00000000-0000-0000-0000-0000000000a1', null, 45000, 60000),
    ('00000000-0000-0000-0000-0000000000d2', 'DEV-HEM-01',  'Sysmex XN-550 Hematology',      'device',     'Siemens', 'Nos', '00000000-0000-0000-0000-0000000000a2', null, 30000, 40000),
    ('00000000-0000-0000-0000-0000000000d3', 'KIT-GLU-01',  'Glucose Reagent Kit (100T)',    'kit',        'Roche',   'Box', '00000000-0000-0000-0000-0000000000a1', 365, 80, 130),
    ('00000000-0000-0000-0000-0000000000d4', 'KIT-CBC-01',  'CBC Reagent Kit (200T)',        'kit',        'Siemens', 'Box', '00000000-0000-0000-0000-0000000000a2', 180, 120, 200),
    ('00000000-0000-0000-0000-0000000000d5', 'SP-PUMP-01',  'Peristaltic Pump Spare',        'spare_part', 'Roche',   'Nos', '00000000-0000-0000-0000-0000000000a1', null, 200, 320)
on conflict do nothing;

-- Devices -------------------------------------------------------------
insert into devices (asset_code, product_id, serial_no, status, lab_id, purchase_date, purchase_price, maintenance_required, next_maintenance_date) values
    ('ACC-ASS-0001', '00000000-0000-0000-0000-0000000000d1', 'C311-778812', 'installed',      '00000000-0000-0000-0000-0000000000c1', '2024-03-10', 45000, true, current_date + 12),
    ('ACC-ASS-0002', '00000000-0000-0000-0000-0000000000d2', 'XN-550-4471', 'in_maintenance', '00000000-0000-0000-0000-0000000000c2', '2023-11-01', 30000, true, current_date - 3),
    ('ACC-ASS-0003', '00000000-0000-0000-0000-0000000000d1', 'C311-778813', 'installed',      '00000000-0000-0000-0000-0000000000c1', '2024-06-20', 45000, true, current_date + 200),
    ('ACC-ASS-0004', '00000000-0000-0000-0000-0000000000d2', 'XN-550-4472', 'out_of_order',   '00000000-0000-0000-0000-0000000000c3', '2022-09-15', 30000, false, null)
on conflict do nothing;

-- Kit batches ---------------------------------------------------------
-- Reorder levels (feed the reordering-rules suggestions) -----------------
update products set reorder_level = 200 where id = '00000000-0000-0000-0000-0000000000d3';
update products set reorder_level = 10  where id = '00000000-0000-0000-0000-0000000000d5';

-- Serial-tracked spare with a demo life cycle (feeds the serial timeline) --
insert into serial_numbers (id, serial_no, product_id, status, warehouse_id, purchase_rate, warranty_period_days, warranty_expiry_date)
values ('00000000-0000-0000-0000-0000000000e5', 'SN-PUMP-0001', '00000000-0000-0000-0000-0000000000d5', 'active',
        '00000000-0000-0000-0000-0000000000b1', 200, 365, current_date + 300)
on conflict do nothing;
update serial_numbers set warehouse_id = '00000000-0000-0000-0000-0000000000b2'
 where id = '00000000-0000-0000-0000-0000000000e5';
update serial_numbers set warehouse_id = null, lab_id = '00000000-0000-0000-0000-0000000000c1', status = 'delivered'
 where id = '00000000-0000-0000-0000-0000000000e5';

insert into kit_batches (batch_no, product_id, warehouse_id, supplier_id, manufacturing_date, expiry_date, qty_received, qty_available, buy_price, sell_price) values
    ('B-GLU-2401', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '2025-06-01', current_date + 20,  100, 60, 80, 130),
    ('B-GLU-2402', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '2025-08-01', current_date + 120, 100, 95, 80, 130),
    ('B-CBC-2401', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', '2025-05-15', current_date + 55,  80,  40, 120, 200)
on conflict do nothing;

-- Sales (drives profit KPI) ------------------------------------------
insert into sales (lab_id, product_id, qty, buy_price, sell_price, sold_at) values
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3', 40, 80,  130, now() - interval '10 days'),
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 1,  45000, 60000, now() - interval '40 days'),
    ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d4', 30, 120, 200, now() - interval '5 days')
on conflict do nothing;

-- Stock movements / withdrawals (drives lab active state) ------------
insert into stock_movements (kit_batch_id, lab_id, type, qty, buy_price, sell_price, moved_at)
select b.id, '00000000-0000-0000-0000-0000000000c1', 'withdrawal', 5, b.buy_price, b.sell_price, now() - interval '3 days'
from kit_batches b where b.batch_no = 'B-GLU-2401'
on conflict do nothing;

-- =====================================================================
-- Banking demo data (migrations 0007-0009)
-- =====================================================================
insert into bank_accounts (id, account_name, bank, account_type, account_no, currency, is_company_account) values
    ('00000000-0000-0000-0000-0000000000e1', 'Main Operating', 'Trade Bank of Iraq', 'Current', '0011-2233', 'USD', true)
on conflict do nothing;

-- a received payment from a lab, awaiting a matching bank line
insert into payment_entries (id, naming_series, payment_type, party_type, party_lab_id, party_name, received_amount, bank_account_id, reference_no, posting_date) values
    ('00000000-0000-0000-0000-0000000000f1', 'ACC-PAY-0001', 'receive', 'lab', '00000000-0000-0000-0000-0000000000c1', 'Al-Kindy Teaching Lab', 5200, '00000000-0000-0000-0000-0000000000e1', 'WIRE-778', current_date - 2),
    ('00000000-0000-0000-0000-0000000000f2', 'ACC-PAY-0002', 'pay',     'company', null, 'Roche Diagnostics', 0, '00000000-0000-0000-0000-0000000000e1', 'PO-5521', current_date - 6)
on conflict do nothing;
update payment_entries set paid_amount = 3100 where id = '00000000-0000-0000-0000-0000000000f2';

-- imported bank statement lines
insert into bank_transactions (id, date, bank_account_id, deposit, withdrawal, description, reference_number, transaction_id) values
    ('00000000-0000-0000-0000-0000000000d1', current_date - 2, '00000000-0000-0000-0000-0000000000e1', 5200, 0, 'INWARD WIRE AL-KINDY LAB', 'WIRE-778', 'BNK-1001'),
    ('00000000-0000-0000-0000-0000000000d2', current_date - 6, '00000000-0000-0000-0000-0000000000e1', 0, 3100, 'OUTWARD ROCHE DIAGNOSTICS', 'PO-5521', 'BNK-1002'),
    ('00000000-0000-0000-0000-0000000000d3', current_date - 1, '00000000-0000-0000-0000-0000000000e1', 0, 90,  'CARD FEE BANK CHARGES',     null,      'BNK-1003')
on conflict do nothing;

-- a matching rule: bank charges -> classify as bank entry
insert into bank_transaction_rules (id, rule_name, transaction_type, priority, classify_as) values
    ('00000000-0000-0000-0000-0000000000c9', 'Bank charges', 'withdrawal', 1, 'bank_entry')
on conflict do nothing;
insert into bank_rule_conditions (rule_id, field, operator, value) values
    ('00000000-0000-0000-0000-0000000000c9', 'description', 'contains', 'BANK CHARGES')
on conflict do nothing;

-- Demo receivables + procurement (drives the dashboard operations panels) ----
do $$
declare v_lab uuid; v_prod uuid; v_inv uuid; v_sup uuid; v_po uuid;
begin
    select id into v_lab from labs where code = 'LAB-001';
    select id into v_prod from products where product_type = 'kit' limit 1;
    select id into v_sup from companies limit 1;

    -- a partly-paid invoice -> shows under Outstanding Receivables
    if v_lab is not null and v_prod is not null
       and not exists (select 1 from sales_invoices where invoice_no = 'SI-2601') then
        insert into sales_invoices (invoice_no, lab_id) values ('SI-2601', v_lab) returning id into v_inv;
        insert into sales_invoice_items (invoice_id, product_id, qty, rate) values (v_inv, v_prod, 20, 130);
        perform fn_submit_sales_invoice(v_inv);
        perform fn_record_invoice_payment(v_inv, 1000);   -- 2600 billed, 1600 outstanding
    end if;

    -- an unpaid invoice
    if v_lab is not null and v_prod is not null
       and not exists (select 1 from sales_invoices where invoice_no = 'SI-2602') then
        insert into sales_invoices (invoice_no, lab_id) values ('SI-2602', v_lab) returning id into v_inv;
        insert into sales_invoice_items (invoice_id, product_id, qty, rate) values (v_inv, v_prod, 8, 130);
        perform fn_submit_sales_invoice(v_inv);
    end if;

    -- a submitted purchase order -> shows under Open Purchase Orders
    if v_sup is not null and v_prod is not null
       and not exists (select 1 from purchase_orders where po_no = 'PO-2601') then
        insert into purchase_orders (po_no, supplier_id) values ('PO-2601', v_sup) returning id into v_po;
        insert into purchase_order_items (po_id, product_id, qty, rate) values (v_po, v_prod, 50, 80);
        perform fn_submit_purchase_order(v_po);
    end if;
end $$;

-- Demo preventive-maintenance schedule (drives the dashboard PM panel) -------
do $$
declare v_dev uuid; v_lab uuid; v_sched uuid;
begin
    select id, lab_id into v_dev, v_lab from devices order by asset_code limit 1;
    if v_dev is not null and not exists (select 1 from maintenance_schedules where schedule_no = 'MS-DEMO-1') then
        insert into maintenance_schedules (schedule_no, lab_id, device_id, periodicity, start_date, no_of_visits)
        values ('MS-DEMO-1', v_lab, v_dev, 'monthly', current_date + 10, 6)
        returning id into v_sched;
        perform fn_generate_maintenance_schedule(v_sched);
    end if;
end $$;

-- Demo maintenance visits (feed the field-service board) -------------------
insert into maintenance_visits (visit_no, lab_id, visit_date, maintenance_type, completion_status, status, service_person, notes) values
  ('MV-2601', '00000000-0000-0000-0000-0000000000c1', current_date,     'scheduled',   'pending', 'submitted', 'Eng. Ali',  'Preventive maintenance due'),
  ('MV-2602', '00000000-0000-0000-0000-0000000000c2', current_date - 1, 'breakdown',   'partial', 'submitted', 'Eng. Sara', 'Analyzer error E-14'),
  ('MV-2603', '00000000-0000-0000-0000-0000000000c1', current_date - 3, 'scheduled',   'full',    'submitted', 'Eng. Ali',  'PM completed'),
  ('MV-2604', '00000000-0000-0000-0000-0000000000c2', current_date,     'unscheduled', 'pending', 'submitted', 'Eng. Omar', 'Customer call-out')
on conflict do nothing;

-- Demo support issue -------------------------------------------------------
do $$
declare v_lab uuid; v_dev uuid;
begin
    select id, (select id from devices where lab_id = labs.id limit 1)
      into v_lab, v_dev from labs where code = 'LAB-001';
    if v_lab is not null and not exists (select 1 from issues where issue_no = 'ISS-0001') then
        insert into issues (issue_no, subject, lab_id, device_id, status, priority, issue_type, description)
        values ('ISS-0001', 'Analyzer shows error E-14 on startup', v_lab, v_dev,
                'open', 'High', 'Hardware', 'Device fails self-test intermittently.');
    end if;
end $$;

-- (portal demo user is seeded separately by seed.sql, after the enum commit)

-- Demo service contract (drives the dashboard 'Expiring contracts' card) -----
do $$
declare v_lab uuid; v_dev uuid;
begin
    select id, (select id from devices where lab_id = labs.id limit 1)
      into v_lab, v_dev from labs where code = 'LAB-001';
    if v_lab is not null and not exists (select 1 from contracts where contract_no = 'AMC-2601') then
        insert into contracts (contract_no, lab_id, device_id, status, start_date, end_date, contract_value, signee, signed_on, contract_terms)
        values ('AMC-2601', v_lab, v_dev, 'active', current_date - 305, current_date + 30, 2400,
                'Dr. Sara', current_date - 305, 'Annual maintenance: 2 preventive visits + breakdown support.');
    end if;
end $$;

-- Demo RFQ with two suppliers -----------------------------------------------
do $$
declare v_prod uuid; v_rfq uuid; v_s1 uuid; v_s2 uuid;
begin
    select id into v_prod from products where product_type='kit' limit 1;
    select id into v_s1 from companies order by name limit 1;
    select id into v_s2 from companies order by name offset 1 limit 1;
    if v_prod is not null and v_s1 is not null and not exists (select 1 from rfqs where rfq_no='RFQ-2601') then
        insert into rfqs (rfq_no, status, message) values ('RFQ-2601','submitted','Please quote your best price + lead time.') returning id into v_rfq;
        insert into rfq_items (rfq_id, product_id, qty) values (v_rfq, v_prod, 100);
        insert into rfq_suppliers (rfq_id, supplier_id) values (v_rfq, v_s1);
        if v_s2 is not null then insert into rfq_suppliers (rfq_id, supplier_id) values (v_rfq, v_s2); end if;
    end if;
end $$;

-- Demo appointment ----------------------------------------------------------
do $$
declare v_lab uuid; v_dev uuid;
begin
    select id, (select id from devices where lab_id = labs.id limit 1)
      into v_lab, v_dev from labs where code = 'LAB-001';
    if v_lab is not null and not exists (select 1 from appointments where appointment_no = 'APT-2601') then
        insert into appointments (appointment_no, lab_id, device_id, purpose, scheduled_time, status, contact_name)
        values ('APT-2601', v_lab, v_dev, 'service', now() + interval '3 days', 'confirmed', 'Dr. Sara');
    end if;
end $$;

-- Demo maintenance team + members + tasks -----------------------------------
do $$
declare v_team uuid;
begin
    if not exists (select 1 from maintenance_teams where name = 'Field Service Team') then
        insert into maintenance_teams (name, manager_name, description)
        values ('Field Service Team', 'Eng. Kareem', 'Handles installs, PM visits and breakdowns.')
        returning id into v_team;
        insert into maintenance_team_members (team_id, member_name, role) values
            (v_team, 'Eng. Kareem', 'Manager'),
            (v_team, 'Tech. Omar', 'Technician'),
            (v_team, 'Tech. Lina', 'Technician');
        insert into maintenance_tasks (team_id, task_name, maintenance_type, periodicity, start_date, status) values
            (v_team, 'Quarterly PM checklist', 'preventive', 'Quarterly', current_date, 'planned'),
            (v_team, 'Annual calibration', 'calibration', 'Yearly', current_date, 'planned');
    end if;
end $$;

-- Demo credit limit (LAB-001 has invoices ~2640 outstanding; set a low limit) -
update labs set credit_limit = 2000 where code = 'LAB-001';

-- Demo pricing rule: 10% off any kit when qty >= 50 --------------------------
do $$
declare v_prod uuid;
begin
    select id into v_prod from products where product_type='kit' limit 1;
    if not exists (select 1 from pricing_rules where title='Bulk kit 10%') then
        insert into pricing_rules (title, product_id, min_qty, discount_percentage)
        values ('Bulk kit 10%', v_prod, 50, 10);
    end if;
end $$;

-- Demo purchase receipt (received into stock) --------------------------------
do $$
declare v_sup uuid; v_prod uuid; v_wh uuid; v_r uuid;
begin
    select id into v_sup from companies limit 1;
    select id into v_prod from products where product_type='kit' limit 1;
    select id into v_wh from warehouses limit 1;
    if v_prod is not null and not exists (select 1 from purchase_receipts where receipt_no='PR-2601') then
        insert into purchase_receipts (receipt_no, supplier_id) values ('PR-2601', v_sup) returning id into v_r;
        insert into purchase_receipt_items (receipt_id, product_id, qty, rate, warehouse_id, batch_no, expiry_date)
        values (v_r, v_prod, 40, 42, v_wh, 'B-PR-2601', current_date + 200);
        perform fn_submit_purchase_receipt(v_r);
    end if;
end $$;

-- Demo payment request (requested against an unpaid invoice) ------------------
do $$
declare v_inv uuid; v_lab uuid; v_out numeric;
begin
    select id, lab_id, outstanding into v_inv, v_lab, v_out
        from sales_invoices where status in ('unpaid','partly_paid') order by outstanding desc limit 1;
    if v_inv is not null and v_out > 0
       and not exists (select 1 from payment_requests where request_no='PREQ-2601') then
        insert into payment_requests (request_no, invoice_id, lab_id, amount, message)
        values ('PREQ-2601', v_inv, v_lab, least(v_out, 500), 'Kindly settle the outstanding balance.');
        perform fn_submit_payment_request((select id from payment_requests where request_no='PREQ-2601'));
    end if;
end $$;

-- Demo blanket order (active selling agreement with a lab) --------------------
do $$
declare v_lab uuid; v_prod uuid; v_sell numeric; v_bo uuid;
begin
    select id into v_lab from labs limit 1;
    select id, default_sell_price into v_prod, v_sell from products where product_type='kit' limit 1;
    if v_lab is not null and v_prod is not null
       and not exists (select 1 from blanket_orders where order_no='BO-2601') then
        insert into blanket_orders (order_no, order_type, lab_id, to_date, notes)
        values ('BO-2601', 'selling', v_lab, current_date + 365, 'Annual reagent-kit supply agreement.')
        returning id into v_bo;
        insert into blanket_order_items (order_id, product_id, qty, rate)
        values (v_bo, v_prod, 500, coalesce(nullif(v_sell,0), 60));
        perform fn_submit_blanket_order(v_bo);
    end if;
end $$;

-- Demo pick list (open, released to the floor) -------------------------------
do $$
declare v_lab uuid; v_prod uuid; v_wh uuid; v_pl uuid;
begin
    select id into v_lab from labs limit 1;
    select id into v_prod from products where product_type='kit' limit 1;
    select id into v_wh from warehouses limit 1;
    if v_prod is not null and not exists (select 1 from pick_lists where pick_no='PICK-2601') then
        insert into pick_lists (pick_no, lab_id, purpose) values ('PICK-2601', v_lab, 'delivery')
        returning id into v_pl;
        insert into pick_list_items (pick_id, product_id, warehouse_id, qty, batch_no)
        values (v_pl, v_prod, v_wh, 12, 'B-PR-2601');
        perform fn_open_pick_list(v_pl);
    end if;
end $$;

-- Demo delivery trip (in transit, one stop) ----------------------------------
do $$
declare v_lab uuid; v_dn uuid; v_trip uuid;
begin
    select id into v_lab from labs limit 1;
    select id into v_dn from delivery_notes order by posting_date desc limit 1;
    if not exists (select 1 from delivery_trips where trip_no='TRIP-2601') then
        insert into delivery_trips (trip_no, driver_name, vehicle)
        values ('TRIP-2601', 'Ahmed K.', 'Van 12-A') returning id into v_trip;
        insert into delivery_trip_stops (trip_id, lab_id, delivery_note_id, address, seq)
        values (v_trip, v_lab, v_dn, 'Central district, main road', 1);
        perform fn_start_delivery_trip(v_trip);
    end if;
end $$;

create table if not exists _spir_migrations (filename text primary key, applied_at timestamptz not null default now());
insert into _spir_migrations(filename) values
  ('0001_core_entities.sql'),
  ('0002_devices_batches.sql'),
  ('0003_movements_sales.sql'),
  ('0004_views_functions.sql'),
  ('0005_rls.sql'),
  ('0006_masters.sql'),
  ('0007_banking.sql'),
  ('0008_banking_logic.sql'),
  ('0009_banking_rls.sql'),
  ('0010_purchasing.sql'),
  ('0011_item_prices.sql'),
  ('0012_payment_terms.sql'),
  ('0013_master_data.sql'),
  ('0014_price_lists.sql'),
  ('0015_serial_numbers.sql'),
  ('0016_warranty_claims.sql'),
  ('0017_sales_orders.sql'),
  ('0018_segmentation.sql'),
  ('0019_categories.sql'),
  ('0020_leads.sql'),
  ('0021_opportunities.sql'),
  ('0022_quotations.sql'),
  ('0023_stock_reconciliation.sql'),
  ('0024_currency_exchange.sql'),
  ('0025_accounts.sql'),
  ('0026_journal_entries.sql'),
  ('0027_delivery_notes.sql'),
  ('0029_material_requests.sql'),
  ('0030_supplier_quotations.sql'),
  ('0031_sales_team.sql'),
  ('0032_taxes.sql'),
  ('0033_manufacturing.sql'),
  ('0034_maintenance_visits.sql'),
  ('0035_stock_entries.sql'),
  ('0036_quality_inspections.sql'),
  ('0037_asset_movements.sql'),
  ('0038_asset_repairs.sql'),
  ('0039_sales_invoices.sql'),
  ('0040_purchase_orders.sql'),
  ('0041_product_bundles.sql'),
  ('0042_installation_notes.sql'),
  ('0043_maintenance_schedules.sql'),
  ('0044_invoice_payments.sql'),
  ('0045_support_issues.sql'),
  ('0046_contracts.sql'),
  ('0047_rfqs.sql'),
  ('0048_appointments.sql'),
  ('0049_maintenance_teams.sql'),
  ('0050_credit_limits.sql'),
  ('0051_pricing_rules.sql'),
  ('0052_masters.sql'),
  ('0053_stock_balance.sql'),
  ('0054_purchase_receipts.sql'),
  ('0055_payment_requests.sql'),
  ('0056_blanket_orders.sql'),
  ('0057_pick_lists.sql'),
  ('0058_delivery_trips.sql'),
  ('0059_auth.sql'),
  ('0060_reports.sql'),
  ('0061_global_search.sql'),
  ('0062_attachments.sql'),
  ('0063_iqd_currency.sql'),
  ('0064_amc_billing.sql'),
  ('0065_audit_trail.sql'),
  ('0066_reorder_rules.sql'),
  ('0067_maintenance_forecast.sql'),
  ('0068_landed_costs.sql'),
  ('0069_warranty_billing.sql'),
  ('0070_customer_portal.sql'),
  ('0071_sales_order_serial.sql'),
  ('0072_feature_settings.sql'),
  ('0073_pos_idempotency.sql'),
  ('0074_monitoring.sql'),
  ('0075_audit_orders.sql'),
  ('0076_sale_stock_deduction.sql'),
  ('0077_auto_gl_posting.sql'),
  ('0078_sales_order_idempotent.sql'),
  ('0079_audit_financial_docs.sql'),
  ('0080_sales_returns.sql'),
  ('0081_return_batch_no_fix.sql'),
  ('0082_return_not_more_than_sold.sql')
on conflict do nothing;
create table if not exists _spir_meta (k text primary key);
insert into _spir_meta(k) values ('bootstrapped') on conflict do nothing;
