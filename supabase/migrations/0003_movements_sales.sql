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
