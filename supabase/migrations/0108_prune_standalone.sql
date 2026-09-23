-- =====================================================================
-- Migration 0108 : A computer on its own still forgets old changes
--
-- The change log was pruned only up to what had been pushed to a peer, so
-- a computer that syncs with nothing — and a main computer serving the
-- office with no hosted database above it — kept every change forever.
--
-- The caller now says how far is safe: nothing given means "what the peer
-- has" (as before); a computer with no upstream passes its whole log. The
-- one-month window still applies. An office computer that has been away
-- longer than that is not stranded: it takes a full copy on its next sync.
-- =====================================================================

drop function if exists fn_spir_prune_changes();

create or replace function fn_spir_prune_changes(p_upto bigint default null) returns integer
language plpgsql as $$
declare
    v_keep int;
    v_upto bigint;
    v_n int;
begin
    select keep_days into v_keep from _spir_retention;
    v_keep := coalesce(v_keep, 30);
    v_upto := coalesce(p_upto, (select max(pushed_through) from _spir_sync_state), 0);
    delete from _spir_changes
     where seq <= v_upto
       and changed_at < now() - make_interval(days => v_keep);
    get diagnostics v_n = row_count;
    return v_n;
end $$;
