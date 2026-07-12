-- =====================================================================
-- Migration 0042 : Installation Note (device installation at a lab)
--
-- Ported (lightened) from ERPNext "Installation Note" (+ item rows). Records
-- installing one or more devices at a lab on a given date. On submit each
-- linked device is marked installed at that lab.
-- =====================================================================

do $$ begin
    create type installation_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists installation_notes (
    id         uuid primary key default gen_random_uuid(),
    inst_no    text not null unique,
    lab_id     uuid references labs(id) on delete set null,
    inst_date  date not null default current_date,
    inst_time  time,
    status     installation_status not null default 'draft',
    remarks    text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_installnotes_lab on installation_notes(lab_id);
create index if not exists idx_installnotes_status on installation_notes(status);

create table if not exists installation_note_items (
    id         uuid primary key default gen_random_uuid(),
    note_id    uuid not null references installation_notes(id) on delete cascade,
    device_id  uuid references devices(id) on delete set null,
    serial_no  text,
    qty        numeric(14,2) not null default 1,
    created_at timestamptz not null default now()
);

create index if not exists idx_installitems_note on installation_note_items(note_id);

-- Submit a note: mark each linked device installed at the note's lab.
-- Returns the number of devices installed.
create or replace function fn_submit_installation_note(p_note_id uuid)
returns integer language plpgsql as $$
declare
    v_note  installation_notes%rowtype;
    v_row   record;
    v_count integer := 0;
begin
    select * into v_note from installation_notes where id = p_note_id for update;
    if not found then raise exception 'Installation note % not found', p_note_id; end if;
    if v_note.status = 'submitted' then
        raise exception 'Installation note % already submitted', v_note.inst_no;
    end if;
    if v_note.status = 'cancelled' then
        raise exception 'Installation note % is cancelled', v_note.inst_no;
    end if;

    for v_row in select * from installation_note_items where note_id = p_note_id and device_id is not null loop
        update devices set
            lab_id = v_note.lab_id,
            status = 'installed'::device_status,
            updated_at = now()
        where id = v_row.device_id;
        v_count := v_count + 1;
    end loop;

    update installation_notes set status = 'submitted', updated_at = now()
    where id = p_note_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['installation_notes','installation_note_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
