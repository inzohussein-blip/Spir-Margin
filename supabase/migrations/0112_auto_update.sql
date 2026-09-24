-- =====================================================================
-- Migration 0112 : Updates
--
-- Every change merged into main that passes the tests is published as a
-- numbered release. An installed computer learns of it by itself (it asks
-- a few times a day) and an administrator installs it from Settings with
-- one click — or lets it install itself at a quiet hour.
--
-- This table holds that choice: off by default, because an update restarts
-- the program for a moment and nobody should be surprised by it mid-sale.
-- Local to this computer (a `_spir` table): each computer updates itself.
-- =====================================================================

create table if not exists _spir_update (
    only_row      boolean primary key default true check (only_row),
    auto          boolean not null default false,
    at_time       text    not null default '02:00' check (at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    last_auto_at  timestamptz,
    updated_at    timestamptz not null default now()
);
insert into _spir_update (only_row) values (true) on conflict do nothing;
