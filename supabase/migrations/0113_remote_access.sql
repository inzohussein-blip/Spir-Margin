-- =====================================================================
-- Migration 0113 : Reaching the main computer from other computers
--
-- The program listens on this computer only (127.0.0.1). Two things now let
-- the company's other computers reach it, both switched on by an
-- administrator on the main computer and both off until then:
--
--   The remote-access gateway: a port of its own (3300 by default) that
--   passes browsers through to the program, so a laptop at home or a phone
--   can use it with an account — over the office network, or over the
--   internet through a private network such as Tailscale. By default a
--   browser must first be paired with a one-time code, so a stranger who
--   finds the port meets a locked door, not a sign-in page.
--
--   Devices: every browser paired, and every computer given a sync code of
--   its own, is listed by name, with when it was last seen, and can be cut
--   off alone — without changing the code for everyone else.
--
-- Local to this computer (`_spir` tables): never synced, and cleared on a
-- computer that joins by taking a full copy of another.
-- =====================================================================

create table if not exists _spir_gateway (
    only_row        boolean primary key default true check (only_row),
    enabled         boolean not null default false,
    port            int     not null default 3300 check (port between 1024 and 65535),
    require_device  boolean not null default true,
    updated_at      timestamptz not null default now()
);
insert into _spir_gateway (only_row) values (true) on conflict do nothing;

create table if not exists _spir_devices (
    id              uuid primary key default gen_random_uuid(),
    name            text not null check (length(name) between 1 and 120),
    kind            text not null check (kind in ('browser', 'computer')),
    -- browser: sha-256 of the token in its cookie (the token itself is never kept)
    token_hash      text,
    -- browser: sha-256 of the one-time pairing code, until it is used or expires
    pair_hash       text,
    pair_expires_at timestamptz,
    -- computer: the secret its sync code encrypts with (both ends need it)
    secret          text,
    created_at      timestamptz not null default now(),
    last_seen_at    timestamptz,
    last_address    text,
    revoked_at      timestamptz
);
create index if not exists _spir_devices_kind on _spir_devices (kind, revoked_at);
