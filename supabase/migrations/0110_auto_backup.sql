-- =====================================================================
-- Migration 0110 : Automatic backups
--
-- A backup that depends on someone remembering is a backup that is missing
-- the day it is needed. This computer now takes one by itself, on a
-- schedule set in Settings: every few hours, every day at a time, or once
-- a week. The copies go to a folder (by default "backups" inside the
-- program's folder — better a second drive, a USB stick or a shared folder)
-- and only the newest few are kept.
--
-- On by default, daily at 22:00, keeping 14: a new install is protected
-- before anyone opens Settings. Local to this computer (a `_spir` table):
-- each computer backs up itself.
-- =====================================================================

create table if not exists _spir_backup (
    only_row     boolean primary key default true check (only_row),
    enabled      boolean not null default true,
    frequency    text    not null default 'daily' check (frequency in ('hours', 'daily', 'weekly')),
    every_hours  int     not null default 6  check (every_hours between 1 and 168),
    at_time      text    not null default '22:00' check (at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    weekday      int     not null default 4  check (weekday between 0 and 6),
    folder       text,
    keep         int     not null default 14 check (keep between 1 and 365),
    last_run_at  timestamptz,
    last_file    text,
    last_error   text,
    updated_at   timestamptz not null default now()
);
insert into _spir_backup (only_row) values (true) on conflict do nothing;
