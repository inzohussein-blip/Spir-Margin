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
