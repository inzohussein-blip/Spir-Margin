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
