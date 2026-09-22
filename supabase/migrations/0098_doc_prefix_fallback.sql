-- =====================================================================
-- Migration 0098 : Document numbers cannot collide, configured or not
--
-- 0095 made the document number unique per machine by putting the branding's
-- `doc_prefix` in front of it — and then left that prefix empty by default.
-- Two machines out of the box therefore both minted REQ-2026-0001, and since
-- `request_no` is unique the second one to sync was refused: an official
-- document, already printed and handed over, silently stranded.
--
-- Telling the operator to set a prefix is not a safeguard; nobody reads a
-- hint before writing their first receipt. So when no prefix is set the
-- number falls back to a short, stable tag derived from this database's own
-- node id, which is unique by construction. A prefix set in Settings still
-- wins, because a company that chose "BGD" wants to see "BGD".
-- =====================================================================

create or replace function fn_next_doc_no(p_kind text) returns text
language plpgsql as $$
declare
    v_year int := extract(year from current_date)::int;
    v_seq  int;
    v_prefix text;
begin
    insert into _spir_doc_counter (kind, year, seq) values (p_kind, v_year, 1)
    on conflict (kind, year) do update set seq = _spir_doc_counter.seq + 1
    returning seq into v_seq;

    select nullif(trim(doc_prefix), '') into v_prefix from _spir_branding;

    -- No prefix chosen: use this machine's own tag rather than nothing, so
    -- two unconfigured machines still cannot produce the same number.
    if v_prefix is null then
        select upper(left(replace(node_id::text, '-', ''), 4)) into v_prefix from _spir_node;
    end if;

    return concat_ws('-', v_prefix, upper(p_kind), v_year::text, lpad(v_seq::text, 4, '0'));
end $$;
