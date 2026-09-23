-- =====================================================================
-- Migration 0105 : Linking computers to each other
--
-- Until now every computer synced with one hub, a hosted database, and sent
-- only the changes it made itself. Offices want their computers to sync over
-- the office network, with one of them (the main computer) passing the whole
-- office's work on to the hosted database for the other branches. For that a
-- computer must forward changes it received as well as its own, without
-- sending anything back where it came from.
--
-- _spir_changes.received_from
--     null for a change made here; otherwise where it came from: 'remote'
--     (the hosted database), 'lan' (the main computer), or 'n:<node id>'
--     (an office computer that sent it to this one). A computer sends a
--     peer everything except what it received from that same peer.
--
-- _spir_peer.lan_code
--     The sync code of the main computer this one is linked to. A computer
--     has at most one upstream: this, or database_url.
--
-- _spir_lan_server, _spir_lan_clients
--     This computer acting as the main computer: whether it serves the
--     office network, the secret its sync code carries, and who has synced.
--
-- All `_spir` tables stay out of the change log, so none of this travels.
-- =====================================================================

alter table _spir_changes add column if not exists received_from text;

alter table _spir_peer add column if not exists lan_code text;

create table if not exists _spir_lan_server (
    only_row    boolean primary key default true check (only_row),
    enabled     boolean not null default false,
    secret      text,
    port        int not null default 3310 check (port between 1024 and 65535),
    updated_at  timestamptz not null default now()
);
insert into _spir_lan_server (only_row) values (true) on conflict do nothing;

create table if not exists _spir_lan_clients (
    node_id        uuid primary key,
    name           text,
    address        text,
    first_seen     timestamptz not null default now(),
    last_seen      timestamptz not null default now(),
    pulled_through bigint not null default 0,
    received       bigint not null default 0
);

-- The gap check moves into the engine, which knows which peer it is talking
-- to; this one only ever looked at 'remote'. Kept so an older build's call
-- still resolves.
create or replace function fn_spir_sync_gap(p_peer_oldest_seq bigint)
returns boolean language sql stable as $$
    select coalesce(
        (select max(pulled_through) from _spir_sync_state) < p_peer_oldest_seq - 1,
        false)
$$;
