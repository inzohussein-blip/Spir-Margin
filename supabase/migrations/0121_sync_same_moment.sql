-- 0121: two changes to one row in one moment both arrive.
--
-- Last-writer-wins (0089) compared (changed_at, origin). Every change made in
-- one transaction carries the same changed_at (now()), so when one operation
-- wrote a row twice — a payment adds to paid_amount, then
-- fn_refresh_invoice_status sets the status — the machine receiving them kept
-- the first and dropped the second as "not newer": the invoice arrived paid
-- in amount but still "unpaid". The row register now also keeps the change's
-- sequence number on the machine that made it, which orders changes of the
-- same moment and origin. Callers that pass no sequence (an older program on
-- a database already migrated) compare as before.

alter table _spir_row_version add column if not exists origin_seq bigint not null default 0;

create or replace function _spir_log_change() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
    v_row  jsonb;
    v_cols text[];
    v_pk   jsonb;
    v_seq  bigint;
    v_now  timestamptz;
    v_me   uuid;
begin
    if coalesce(current_setting('spir.syncing', true), '') = 'on' then
        return coalesce(new, old);
    end if;

    v_row := to_jsonb(coalesce(new, old));

    select array_agg(a.attname order by k.ord)
      into v_cols
      from pg_index i
      join lateral unnest(i.indkey) with ordinality k(attnum, ord) on true
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
     where i.indrelid = tg_relid and i.indisprimary;

    -- No primary key means no way to address the row on the other side.
    if v_cols is null then
        return coalesce(new, old);
    end if;

    select jsonb_object_agg(c, v_row -> c) into v_pk from unnest(v_cols) c;

    -- Take the sequence value up front so the row can carry it as its own
    -- origin_seq: locally-made changes are their own origin.
    v_seq := nextval('_spir_changes_seq_seq');

    v_now := now();
    v_me := _spir_node_id();

    insert into _spir_changes (seq, origin, origin_seq, table_name, op, pk, row, changed_at)
    values (
        v_seq,
        v_me,
        v_seq,
        tg_table_name,
        case tg_op when 'INSERT' then 'I' when 'UPDATE' then 'U' else 'D' end,
        v_pk,
        case when tg_op = 'DELETE' then null else v_row end,
        v_now
    );

    insert into _spir_row_version (table_name, pk_text, changed_at, origin, origin_seq)
    values (tg_table_name, v_pk::text, v_now, v_me, v_seq)
    on conflict (table_name, pk_text)
      do update set changed_at = excluded.changed_at, origin = excluded.origin, origin_seq = excluded.origin_seq;

    return coalesce(new, old);
end $$;

drop function if exists _spir_apply_change(text, char, jsonb, jsonb, timestamptz, uuid);

create or replace function _spir_apply_change(
    p_table text, p_op char, p_pk jsonb, p_row jsonb,
    p_changed_at timestamptz, p_origin uuid, p_origin_seq bigint default 0
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
    v_reg      regclass;
    v_pkcols   text[];
    v_allcols  text[];
    v_setcols  text[];
    v_conflict text;
    v_collist  text;
    v_set      text;
    v_join     text;
    v_have     record;
begin
    v_reg := to_regclass('public.' || quote_ident(p_table));
    if v_reg is null then
        raise exception 'جدول غير معروف: %', p_table;
    end if;

    select array_agg(a.attname order by k.ord)
      into v_pkcols
      from pg_index i
      join lateral unnest(i.indkey) with ordinality k(attnum, ord) on true
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
     where i.indrelid = v_reg and i.indisprimary;

    if v_pkcols is null then
        raise exception 'الجدول % بلا مفتاح أساسي', p_table;
    end if;

    -- Last-writer-wins. A change older than what this row already holds is
    -- dropped, so the result does not depend on the order machines sync in.
    -- Changes made by one statement or one transaction share their moment
    -- (now()), so their order on the machine that made them breaks the tie.
    select changed_at, origin, origin_seq into v_have
      from _spir_row_version
     where table_name = p_table and pk_text = p_pk::text;

    if found and (v_have.changed_at, v_have.origin, v_have.origin_seq) >= (p_changed_at, p_origin, coalesce(p_origin_seq, 0)) then
        return false;
    end if;

    -- Do not re-log what we are replaying.
    perform set_config('spir.syncing', 'on', true);

    select string_agg(quote_ident(c), ', ') into v_conflict from unnest(v_pkcols) c;
    select string_agg(format('t.%I = k.%I', c, c), ' and ') into v_join from unnest(v_pkcols) c;

    if p_op = 'D' then
        execute format(
            'delete from %I t using jsonb_populate_record(null::%I, $1) k where %s',
            p_table, p_table, v_join) using p_pk;
    else
        -- Generated columns are computed by the database and cannot be
        -- written, so they are named out of both the insert and the update.
        select array_agg(a.attname order by a.attnum) into v_allcols
          from pg_attribute a
         where a.attrelid = v_reg and a.attnum > 0
           and not a.attisdropped and a.attgenerated = '';

        select array_agg(c) into v_setcols
          from unnest(v_allcols) c where not (c = any (v_pkcols));

        select string_agg(quote_ident(c), ', ') into v_collist from unnest(v_allcols) c;

        if v_setcols is null then
            -- A pure key table: nothing to update, so the insert is enough.
            execute format(
                'insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1)
                   on conflict (%s) do nothing',
                p_table, v_collist, v_collist, p_table, v_conflict) using p_row;
        else
            select string_agg(format('%I = excluded.%I', c, c), ', ') into v_set
              from unnest(v_setcols) c;
            execute format(
                'insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1)
                   on conflict (%s) do update set %s',
                p_table, v_collist, v_collist, p_table, v_conflict, v_set) using p_row;
        end if;
    end if;

    insert into _spir_row_version (table_name, pk_text, changed_at, origin, origin_seq)
    values (p_table, p_pk::text, p_changed_at, p_origin, coalesce(p_origin_seq, 0))
    on conflict (table_name, pk_text)
      do update set changed_at = excluded.changed_at, origin = excluded.origin, origin_seq = excluded.origin_seq;

    perform set_config('spir.syncing', 'off', true);
    return true;
end $$;
