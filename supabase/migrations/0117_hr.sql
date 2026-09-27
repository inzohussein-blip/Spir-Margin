-- =====================================================================
-- Migration 0117 : Staff & shifts (الكادر والدوام)
--
-- The company's own people: who works here, the shifts they are rostered
-- on, when they came and left, their leave, the advances they took, and a
-- monthly payroll sheet built from all of that (src/lib/hr/core.ts).
-- Ported from spir-lab-manager's roster station and kept on the database
-- like everything else, so it syncs between the company's computers.
--
-- One roster cell and one attendance row per person per day. Their ids are
-- derived from the person and the day, so two computers that fill in the
-- same day write the same row — the later write wins, no duplicates.
-- Nothing is seeded: a new company adds its own shifts (one click on the
-- Shifts page adds the usual three).
-- =====================================================================

create table if not exists hr_employees (
    id           uuid primary key default gen_random_uuid(),
    code         text unique,
    full_name    text not null,
    job_title    text,
    department   text,
    phone        text,
    hire_date    date,
    base_salary  numeric(14, 2) not null default 0 check (base_salary >= 0),
    currency     text not null default 'IQD',
    color        text not null default '#0284c7',
    is_active    boolean not null default true,
    notes        text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create table if not exists hr_shift_types (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    start_time  text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
    end_time    text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
    color       text not null default '#0ea5e9',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists hr_roster (
    id             uuid primary key,
    employee_id    uuid not null references hr_employees(id) on delete cascade,
    work_date      date not null,
    shift_type_id  uuid references hr_shift_types(id) on delete set null,
    is_off         boolean not null default false,
    covered_by     uuid references hr_employees(id) on delete set null,
    note           text,
    updated_at     timestamptz not null default now(),
    unique (employee_id, work_date)
);
create index if not exists idx_hr_roster_date on hr_roster(work_date);
create index if not exists idx_hr_roster_shift on hr_roster(shift_type_id);
create index if not exists idx_hr_roster_cover on hr_roster(covered_by);

create table if not exists hr_attendance (
    id           uuid primary key,
    employee_id  uuid not null references hr_employees(id) on delete cascade,
    work_date    date not null,
    check_in     text check (check_in ~ '^[0-2][0-9]:[0-5][0-9]$'),
    check_out    text check (check_out ~ '^[0-2][0-9]:[0-5][0-9]$'),
    note         text,
    updated_at   timestamptz not null default now(),
    unique (employee_id, work_date)
);
create index if not exists idx_hr_attendance_date on hr_attendance(work_date);

create table if not exists hr_leaves (
    id           uuid primary key default gen_random_uuid(),
    employee_id  uuid not null references hr_employees(id) on delete cascade,
    leave_type   text not null check (leave_type in ('annual', 'sick', 'emergency', 'unpaid')),
    from_date    date not null,
    to_date      date not null,
    note         text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    check (to_date >= from_date)
);
create index if not exists idx_hr_leaves_employee on hr_leaves(employee_id);
create index if not exists idx_hr_leaves_dates on hr_leaves(from_date, to_date);

create table if not exists hr_advances (
    id            uuid primary key default gen_random_uuid(),
    employee_id   uuid not null references hr_employees(id) on delete cascade,
    advance_date  date not null default current_date,
    amount        numeric(14, 2) not null check (amount > 0),
    deduct_month  text not null check (deduct_month ~ '^[0-9]{4}-[0-1][0-9]$'),
    note          text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists idx_hr_advances_employee on hr_advances(employee_id);
create index if not exists idx_hr_advances_month on hr_advances(deduct_month);

-- One row: the rules the attendance and payroll sheets apply.
create table if not exists hr_settings (
    only_row           boolean primary key default true check (only_row),
    grace_minutes      int not null default 10 check (grace_minutes between 0 and 240),
    annual_leave_days  int not null default 20 check (annual_leave_days between 0 and 365),
    week_start         int not null default 6 check (week_start between 0 and 6),  -- 0 Sunday … 6 Saturday
    deduct_absence     boolean not null default false,
    updated_at         timestamptz not null default now()
);

-- ── The day's id: the same person and day give the same row everywhere ──
create or replace function fn_hr_day_id(p_kind text, p_employee uuid, p_date date) returns uuid
language sql immutable as $$
    select md5(p_kind || '|' || p_employee::text || '|' || p_date::text)::uuid
$$;

/** Put someone on a shift (or rest) for a day; no shift and not resting clears the cell. */
create or replace function fn_hr_set_shift(p_employee uuid, p_date date, p_shift uuid, p_off boolean default false)
returns void language plpgsql as $$
begin
    if p_shift is null and not coalesce(p_off, false) then
        delete from hr_roster where employee_id = p_employee and work_date = p_date;
        return;
    end if;
    insert into hr_roster (id, employee_id, work_date, shift_type_id, is_off)
    values (fn_hr_day_id('roster', p_employee, p_date), p_employee, p_date,
            case when coalesce(p_off, false) then null else p_shift end, coalesce(p_off, false))
    on conflict (id) do update
       set shift_type_id = excluded.shift_type_id, is_off = excluded.is_off, updated_at = now();
end $$;

/** Who covers someone's day (null: nobody). */
create or replace function fn_hr_set_cover(p_employee uuid, p_date date, p_by uuid)
returns void language plpgsql as $$
begin
    if p_by is not null and p_by = p_employee then
        raise exception 'لا يمكن أن يغطي الموظف دوام نفسه.';
    end if;
    insert into hr_roster (id, employee_id, work_date, covered_by)
    values (fn_hr_day_id('roster', p_employee, p_date), p_employee, p_date, p_by)
    on conflict (id) do update set covered_by = excluded.covered_by, updated_at = now();
end $$;

/** Copy a week of the roster (seven days from p_from) onto the week starting p_to. */
create or replace function fn_hr_copy_week(p_from date, p_to date)
returns int language plpgsql as $$
declare n int;
begin
    if p_from = p_to then return 0; end if;
    delete from hr_roster where work_date between p_to and p_to + 6;
    insert into hr_roster (id, employee_id, work_date, shift_type_id, is_off)
    select fn_hr_day_id('roster', r.employee_id, r.work_date + (p_to - p_from)),
           r.employee_id, r.work_date + (p_to - p_from), r.shift_type_id, r.is_off
      from hr_roster r
     where r.work_date between p_from and p_from + 6
       and (r.shift_type_id is not null or r.is_off);
    get diagnostics n = row_count;
    return n;
end $$;

/** A day's attendance: arrival, departure and a note (all empty clears it). */
create or replace function fn_hr_set_attendance(p_employee uuid, p_date date, p_in text, p_out text, p_note text default null)
returns void language plpgsql as $$
begin
    p_in := nullif(trim(coalesce(p_in, '')), '');
    p_out := nullif(trim(coalesce(p_out, '')), '');
    p_note := nullif(trim(coalesce(p_note, '')), '');
    if p_in is null and p_out is null and p_note is null then
        delete from hr_attendance where employee_id = p_employee and work_date = p_date;
        return;
    end if;
    insert into hr_attendance (id, employee_id, work_date, check_in, check_out, note)
    values (fn_hr_day_id('attendance', p_employee, p_date), p_employee, p_date, p_in, p_out, p_note)
    on conflict (id) do update
       set check_in = excluded.check_in, check_out = excluded.check_out, note = excluded.note, updated_at = now();
end $$;

/** "Arrived" / "left" now: keeps the other half of the day as it is. */
create or replace function fn_hr_punch(p_employee uuid, p_date date, p_kind text, p_time text)
returns void language plpgsql as $$
begin
    if p_kind not in ('in', 'out') then
        raise exception 'نوع التسجيل غير صحيح.';
    end if;
    insert into hr_attendance (id, employee_id, work_date, check_in, check_out)
    values (fn_hr_day_id('attendance', p_employee, p_date), p_employee, p_date,
            case when p_kind = 'in' then p_time end, case when p_kind = 'out' then p_time end)
    on conflict (id) do update
       set check_in  = case when p_kind = 'in'  then excluded.check_in  else hr_attendance.check_in end,
           check_out = case when p_kind = 'out' then excluded.check_out else hr_attendance.check_out end,
           updated_at = now();
end $$;

select _spir_attach_change_log();
