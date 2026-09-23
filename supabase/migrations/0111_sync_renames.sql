-- =====================================================================
-- Migration 0111 : Two computers, one code
--
-- Two computers working apart can each create a record with the same code
-- — lab LAB-9 here, a different LAB-9 there. The first to arrive takes it;
-- the second was refused and sat in Sync Health until someone renamed it.
--
-- Now the computer whose record has not been delivered yet renames its own
-- value by adding a short tag of its own (LAB-9 → LAB-9-A1B2) and sends it
-- again. Only codes and numbers are renamed, never an email and never a
-- value other records point at. Each rename is kept here, on the computer
-- that made it, and listed in Sync Health so the change is not a surprise.
-- =====================================================================

create table if not exists _spir_sync_renames (
    id          bigserial primary key,
    table_name  text not null,
    pk          jsonb not null,
    column_name text not null,
    old_value   text not null,
    new_value   text not null,
    at          timestamptz not null default now()
);
create index if not exists idx_spir_sync_renames_at on _spir_sync_renames(at desc);
