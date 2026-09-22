-- =====================================================================
-- Migration 0092 : Keep one month of change log
--
-- `_spir_changes` recorded every row change forever, with the whole row as
-- JSON. On a working install that grows without limit: disk, and a slower
-- scan on every sync.
--
-- One month is kept. Two rules decide what may go:
--
--   * it must already have been pushed to the peer — an unsent change is the
--     only copy of that work outside this machine's tables, so it stays no
--     matter how old it is;
--   * it must be older than the retention window.
--
-- `_spir_row_version` is NOT pruned. It is one small row per record ever
-- touched (no payload), and it is what last-writer-wins compares against —
-- dropping it would let an old change coming back from a peer overwrite
-- newer data.
--
-- The cost of the window: a machine that has been away longer than a month
-- may find the peer has forgotten changes it never pulled. It is not silent —
-- `_spir_sync_state.pulled_through` would point before the peer's oldest
-- remaining row, which `fn_spir_sync_gap` reports so the app can say a full
-- refresh is needed rather than quietly skipping the gap.
-- =====================================================================

create table if not exists _spir_retention (
    only_row boolean primary key default true check (only_row),
    keep_days int not null default 30 check (keep_days between 1 and 3650)
);
insert into _spir_retention (only_row) values (true) on conflict do nothing;

/**
 * Delete pushed changes older than the window. Returns how many went.
 */
create or replace function fn_spir_prune_changes() returns integer
language plpgsql as $$
declare
    v_keep int;
    v_pushed bigint;
    v_n int;
begin
    select keep_days into v_keep from _spir_retention;
    v_keep := coalesce(v_keep, 30);

    -- Never past what the peer has accepted. With no peer configured nothing
    -- has been pushed, so nothing is eligible and the log is kept whole —
    -- which is right: it is the only record of what would need to sync.
    select coalesce(max(pushed_through), 0) into v_pushed from _spir_sync_state;

    delete from _spir_changes
     where seq <= v_pushed
       and changed_at < now() - make_interval(days => v_keep);
    get diagnostics v_n = row_count;
    return v_n;
end $$;

/**
 * True when the peer's log no longer reaches back to where we stopped
 * reading, so a pull would silently skip changes. The caller passes the
 * peer's oldest remaining seq — only the sync engine can see the far side.
 */
create or replace function fn_spir_sync_gap(p_peer_oldest_seq bigint)
returns boolean language sql stable as $$
    select coalesce(
        (select pulled_through from _spir_sync_state where peer = 'remote') < p_peer_oldest_seq - 1,
        false)
$$;
