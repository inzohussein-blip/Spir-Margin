-- =====================================================================
-- Migration 0115 : This computer's activation code
--
-- Each subscribing company gets one code from the owner, good for a number of
-- computers, for a number of days, opening a set of stations. A computer
-- enters it once, online; from then on it keeps a signed license here and
-- checks it offline on every start, refreshing it from the codes server when
-- it can (a renewal, a change of stations, a stop, the company's database).
--
-- `legacy` marks a computer that already held records when this arrived: it
-- keeps working for 30 days before it asks for its code.
--
-- Local to this computer (`_spir` tables): never synced, not copied to a
-- computer that joins by taking a full copy, and kept as it is when a backup
-- is restored (a backup from another computer must not carry that
-- computer's identity or license here).
-- =====================================================================

create table if not exists _spir_license (
    only_row     boolean primary key default true check (only_row),
    device_id    text    not null default replace(gen_random_uuid()::text, '-', ''),
    token        text,
    pub          jsonb,
    checked_at   bigint,
    message      text    not null default '',
    blocked      text,
    version      text    not null default '',
    enabled      boolean,
    contact      text    not null default '',
    seen_at      bigint  not null default 0,
    legacy       boolean not null default false,
    grace_start  bigint,
    sync_host    text    not null default '',
    updated_at   timestamptz not null default now()
);

insert into _spir_license (only_row, legacy)
select true,
       exists (select 1 from products)
       or exists (select 1 from labs)
       or exists (select 1 from companies)
       or exists (select 1 from sales_invoices)
on conflict (only_row) do nothing;
