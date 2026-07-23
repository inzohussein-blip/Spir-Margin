-- =====================================================================
-- Migration 0074 : Monitoring (errors, connectivity & sync health)
--
-- Three admin/authorised-only monitoring surfaces:
--   1. app_errors        — application errors reported from the client, error
--                          boundaries and the server, so an operator can see
--                          at a glance whether everything is working.
--   2. audit_log (0065)  — reused for "what was deleted or changed".
--   3. connectivity_events + sync_events — proof that, after the network drops
--      and returns, the offline queue synced correctly, plus how long the
--      connection was actually down.
-- =====================================================================

-- 1) Application error log --------------------------------------------------
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

-- 2) Connectivity outages (one row per completed offline period) ------------
create table if not exists connectivity_events (
    id               bigint generated always as identity primary key,
    user_email       text,
    went_offline_at  timestamptz not null,
    came_online_at   timestamptz not null,
    duration_seconds numeric not null,
    created_at       timestamptz not null default now()
);
create index if not exists idx_connectivity_time on connectivity_events(came_online_at desc);

-- 3) Sync results (one row per outbox flush) --------------------------------
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
