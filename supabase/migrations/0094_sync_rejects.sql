-- =====================================================================
-- Migration 0094 : Changes the far end refused
--
-- The engine steps over a change the peer rejects rather than retrying it
-- forever, because stopping would strand every later change behind one bad
-- row. But it kept only the first rejection, in `last_error`, and stepped
-- over the rest — so two databases could drift apart with nothing to show
-- for it but a single stale sentence.
--
-- Every rejection is recorded here instead, with enough to act on: which
-- record, which direction it was going, and what the far end said. A row is
-- resolved when a later pass gets the same change across, or when someone
-- decides it no longer matters.
-- =====================================================================

create table if not exists _spir_sync_rejects (
    id          bigserial primary key,
    direction   text not null check (direction in ('push', 'pull')),
    table_name  text not null,
    pk          jsonb not null,
    op          char(1) not null check (op in ('I', 'U', 'D')),
    error       text not null,
    first_seen  timestamptz not null default now(),
    last_seen   timestamptz not null default now(),
    attempts    int not null default 1,
    resolved_at timestamptz
);

-- One open row per record per direction: a change that keeps failing counts
-- up rather than filling the table with identical rows.
create unique index if not exists idx_spir_rejects_open
    on _spir_sync_rejects(direction, table_name, pk)
    where resolved_at is null;

create index if not exists idx_spir_rejects_unresolved
    on _spir_sync_rejects(last_seen desc) where resolved_at is null;

/** Record a refusal, or count up the one already open for that record. */
create or replace function fn_spir_note_reject(
    p_direction text, p_table text, p_pk jsonb, p_op char, p_error text
) returns void language plpgsql as $$
begin
    insert into _spir_sync_rejects (direction, table_name, pk, op, error)
    values (p_direction, p_table, p_pk, p_op, p_error)
    on conflict (direction, table_name, pk) where resolved_at is null
    do update set last_seen = now(),
                  attempts  = _spir_sync_rejects.attempts + 1,
                  error     = excluded.error;
end $$;

/** Mark a record's rejection settled once its change finally gets across. */
create or replace function fn_spir_clear_reject(
    p_direction text, p_table text, p_pk jsonb
) returns void language sql as $$
    update _spir_sync_rejects set resolved_at = now()
     where direction = p_direction and table_name = p_table and pk = p_pk
       and resolved_at is null;
$$;
