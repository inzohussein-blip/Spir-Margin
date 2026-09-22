-- =====================================================================
-- Migration 0089 : Change log for offline-first sync
--
-- The app runs on an embedded database on each machine and treats a hosted
-- Postgres, when one is configured, as a PEER rather than as the store. To
-- converge the two, every database keeps a log of its own row changes, and
-- sync is: push the rows of my log the peer has not seen, pull the rows of
-- its log I have not seen, and apply them.
--
-- Both ends run these same migrations, so both ends have the log, the apply
-- function and the cursors. That symmetry is the whole design — there is no
-- "server" side and no separate protocol.
--
-- Conflicts: this is a single-company install, so the rule is last writer
-- wins per row, ordered by the sequence in which changes were recorded.
-- =====================================================================

-- ── Identity ────────────────────────────────────────────────────────
-- Who produced a change. Needed so a node can skip its own changes when
-- they come back around from the peer.
create table if not exists _spir_node (
    only_row boolean primary key default true check (only_row),
    node_id  uuid not null default gen_random_uuid(),
    created_at timestamptz not null default now()
);
insert into _spir_node (only_row) values (true) on conflict do nothing;

create or replace function _spir_node_id() returns uuid
language sql stable as $$ select node_id from _spir_node $$;

-- ── The log ─────────────────────────────────────────────────────────
-- `origin` + `origin_seq` identify a change globally: the node that made it
-- and the position it had in THAT node's log. A push carries both across, so
-- the peer's log becomes the union of every node's changes and a third
-- machine can pull what the others wrote. The unique key on the pair is what
-- makes a re-pushed batch land exactly once.
create table if not exists _spir_changes (
    seq        bigserial primary key,
    origin     uuid not null,
    origin_seq bigint not null,
    table_name text not null,
    op         char(1) not null check (op in ('I', 'U', 'D')),
    pk         jsonb not null,
    row        jsonb,                 -- the new row for I/U, null for D
    changed_at timestamptz not null default now()
);
create unique index if not exists idx_spir_changes_origin_seq
    on _spir_changes(origin, origin_seq);
create index if not exists idx_spir_changes_table on _spir_changes(table_name);

-- ── Cursors ─────────────────────────────────────────────────────────
create table if not exists _spir_sync_state (
    peer            text primary key,
    pushed_through  bigint not null default 0,   -- my seq the peer has
    pulled_through  bigint not null default 0,   -- peer seq I have applied
    last_sync_at    timestamptz,
    last_error      text
);

-- ── Row versions ────────────────────────────────────────────────────
-- Last-writer-wins needs a per-row clock. Ordering by arrival at the peer is
-- NOT convergent: a machine can pull a change that reached the peer earlier
-- but was made before its own, and clobber newer data with older. So every
-- row carries the time and origin of the change that last set it, and a
-- change is applied only when it beats what is already there. `origin`
-- breaks ties between two changes stamped the same instant, so every node
-- reaches the same answer regardless of the order it syncs in.
create table if not exists _spir_row_version (
    table_name text not null,
    pk_text    text not null,
    changed_at timestamptz not null,
    origin     uuid not null,
    primary key (table_name, pk_text)
);

-- ── Recording ───────────────────────────────────────────────────────
-- `spir.syncing` is set while a change is being applied FROM the peer, so
-- applying it does not record a new change and bounce it back.
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

    insert into _spir_row_version (table_name, pk_text, changed_at, origin)
    values (tg_table_name, v_pk::text, v_now, v_me)
    on conflict (table_name, pk_text)
      do update set changed_at = excluded.changed_at, origin = excluded.origin;

    return coalesce(new, old);
end $$;

-- ── Attaching ───────────────────────────────────────────────────────
-- Called again after every migration run, so a table added by a later
-- migration is covered without anyone remembering to wire it up.
--
-- Excluded: the sync machinery itself (logging the log would not
-- terminate), the migration ledger, and local-only telemetry — error
-- reports, audit rows, login attempts and connectivity samples describe
-- THIS machine and are meaningless on another one.
create or replace function _spir_attach_change_log() returns void
language plpgsql as $$
declare
    r record;
begin
    for r in
        select c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind = 'r'
           and left(c.relname, 5) <> '_spir'
           and c.relname not in (
               'audit_log', 'app_errors', 'login_attempts',
               'connectivity_events', 'sync_events', 'idempotency_keys'
           )
           and exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisprimary)
    loop
        execute format('drop trigger if exists zz_spir_change_log on %I', r.relname);
        execute format(
            'create trigger zz_spir_change_log after insert or update or delete on %I
               for each row execute function _spir_log_change()', r.relname);
    end loop;
end $$;

select _spir_attach_change_log();

-- ── Applying ────────────────────────────────────────────────────────
-- Replays one logged change onto this database, if it beats what is already
-- there. Used by the sync engine on both ends; `jsonb_populate_record`
-- against the table's own row type is what gets every column back to its real
-- type. Returns true when the change was applied, false when it lost.
create or replace function _spir_apply_change(
    p_table text, p_op char, p_pk jsonb, p_row jsonb,
    p_changed_at timestamptz, p_origin uuid
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
        raise exception 'unknown table %', p_table;
    end if;

    select array_agg(a.attname order by k.ord)
      into v_pkcols
      from pg_index i
      join lateral unnest(i.indkey) with ordinality k(attnum, ord) on true
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
     where i.indrelid = v_reg and i.indisprimary;

    if v_pkcols is null then
        raise exception 'table % has no primary key', p_table;
    end if;

    -- Last-writer-wins. A change older than what this row already holds is
    -- dropped, so the result does not depend on the order machines sync in.
    select changed_at, origin into v_have
      from _spir_row_version
     where table_name = p_table and pk_text = p_pk::text;

    if found and (v_have.changed_at, v_have.origin) >= (p_changed_at, p_origin) then
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

    insert into _spir_row_version (table_name, pk_text, changed_at, origin)
    values (p_table, p_pk::text, p_changed_at, p_origin)
    on conflict (table_name, pk_text)
      do update set changed_at = excluded.changed_at, origin = excluded.origin;

    perform set_config('spir.syncing', 'off', true);
    return true;
end $$;
