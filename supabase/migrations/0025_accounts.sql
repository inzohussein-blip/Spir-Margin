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
