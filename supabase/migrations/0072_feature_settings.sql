-- =====================================================================
-- Migration 0072 : Feature settings & per-account access
--
-- Two independent controls, both admin-managed:
--
--  1. feature_flags — a global three-state switch per non-essential feature:
--       'enabled'  (default) the feature works normally
--       'disabled' the feature is visible but turned off (blocked when opened)
--       'hidden'   the feature is removed from the app entirely
--     A feature that has no row here is treated as 'enabled'.
--
--  2. user_feature_access — a per-account DENY list. The presence of a row
--     means "this account may NOT use this feature" (essential or not). An
--     account with no rows has full access (the default).
--
-- "Features" are the app's module groups (Selling, Buying, Stock, …). The
-- application layer owns the catalogue of feature keys and which ones are core
-- (and therefore never disable-/hide-able); the database just stores state.
-- =====================================================================

create table if not exists feature_flags (
    feature    text primary key,
    state      text not null default 'enabled' check (state in ('enabled','disabled','hidden')),
    updated_at timestamptz not null default now()
);

create table if not exists user_feature_access (
    user_id    uuid not null references app_users(id) on delete cascade,
    feature    text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, feature)
);

create index if not exists idx_user_feature_access_user on user_feature_access(user_id);

alter table feature_flags enable row level security;
alter table user_feature_access enable row level security;
drop policy if exists "authenticated_all" on feature_flags;
drop policy if exists "authenticated_all" on user_feature_access;
create policy "authenticated_all" on feature_flags for all to authenticated using (true) with check (true);
create policy "authenticated_all" on user_feature_access for all to authenticated using (true) with check (true);
