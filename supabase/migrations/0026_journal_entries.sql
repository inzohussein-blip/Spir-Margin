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
