-- =====================================================================
-- Migration 0065 : Immutable audit trail (ported idea from Tryton)
--
-- Medical-device records (devices, maintenance, contracts, serials) and the
-- money tables (sales, invoices) must be traceable: every insert/update/delete
-- is captured with a full before/after snapshot and the changed field list.
-- The log is APPEND-ONLY — an update or delete on audit_log itself raises — so
-- history cannot be rewritten, even by whoever made the change.
--
-- "Who" is read from the `app.actor` GUC when the app sets it; the "what /
-- when / how" is captured unconditionally at the database level, so it cannot
-- be bypassed by any code path.
-- =====================================================================

create table if not exists audit_log (
    id             bigint generated always as identity primary key,
    table_name     text        not null,
    record_id      uuid,
    action         text        not null check (action in ('INSERT','UPDATE','DELETE')),
    actor          text,
    changed_at     timestamptz not null default now(),
    old_data       jsonb,
    new_data       jsonb,
    changed_fields text[]
);

create index if not exists idx_audit_record on audit_log(table_name, record_id);
create index if not exists idx_audit_time on audit_log(changed_at desc);

-- Capture a row change. SECURITY DEFINER so it can always write the log
-- regardless of the caller's privileges on audit_log.
create or replace function fn_audit() returns trigger
language plpgsql security definer as $$
declare
    v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
    v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
    v_rec uuid  := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
    v_fields text[];
begin
    if tg_op = 'UPDATE' then
        select array_agg(k order by k) into v_fields
        from jsonb_object_keys(v_new) k
        where k not in ('updated_at')
          and (v_new -> k) is distinct from (v_old -> k);
        -- a no-op update (only updated_at moved) is not worth a row
        if v_fields is null then return new; end if;
    end if;

    insert into audit_log (table_name, record_id, action, actor, old_data, new_data, changed_fields)
    values (tg_table_name, v_rec, tg_op,
            nullif(current_setting('app.actor', true), ''),
            v_old, v_new, v_fields);
    return coalesce(new, old);
end $$;

-- Make audit_log append-only.
create or replace function fn_audit_immutable() returns trigger
language plpgsql as $$
begin
    raise exception 'audit_log is append-only; % is not permitted', tg_op;
end $$;

drop trigger if exists trg_audit_immutable on audit_log;
create trigger trg_audit_immutable before update or delete on audit_log
    for each row execute function fn_audit_immutable();

-- Attach the audit trigger to the compliance- and money-critical tables.
do $$
declare t text;
begin
    foreach t in array array[
        'sales','sales_invoices','contracts','devices','maintenance_visits',
        'serial_numbers','products','labs','purchase_invoices','stock_movements'
    ]
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

-- Read access (append-only, no update/delete policy on purpose).
alter table audit_log enable row level security;
drop policy if exists "authenticated_read" on audit_log;
create policy "authenticated_read" on audit_log for select to authenticated using (true);
