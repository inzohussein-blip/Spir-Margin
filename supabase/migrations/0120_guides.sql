-- =====================================================================
-- Migration 0120 : Guides & training (الأدلة والتدريب)
--
-- Ported from spir-lab-manager's training station, for the devices and kits
-- this company sells and services: a guide per device, kit or procedure —
-- its purpose, the steps (warnings marked), practical tips, safety, and a
-- troubleshooting table (problem → cause → fix) — with its pictures and PDFs
-- as attachments (entity 'kb_guide'). Document control: the version goes up
-- by itself whenever the content changes, with who reviewed it and when it
-- is due for review again.
--
-- Trainees take quizzes generated from the guides (src/lib/guides/quiz.ts);
-- each attempt is kept with its score.
-- =====================================================================

create table if not exists kb_guides (
    id           uuid primary key default gen_random_uuid(),
    title        text not null,
    category     text not null default 'device' check (category in ('device', 'kit', 'procedure', 'safety', 'other')),
    product_id   uuid references products(id) on delete set null,
    purpose      text,
    summary      text,
    steps        jsonb not null default '[]'::jsonb,   -- [{ "text": …, "warn": true|false }]
    tips         jsonb not null default '[]'::jsonb,   -- [text]
    safety       text,
    troubles     jsonb not null default '[]'::jsonb,   -- [{ "problem": …, "cause": …, "fix": … }]
    version      int not null default 1,
    reviewed_by  text,
    reviewed_at  date,
    next_review  date,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists idx_kb_guides_product on kb_guides(product_id);
create index if not exists idx_kb_guides_category on kb_guides(category);

create table if not exists kb_trainees (
    id           uuid primary key default gen_random_uuid(),
    full_name    text not null,
    employee_id  uuid references hr_employees(id) on delete set null,
    notes        text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists idx_kb_trainees_employee on kb_trainees(employee_id);

create table if not exists kb_results (
    id          uuid primary key default gen_random_uuid(),
    trainee_id  uuid not null references kb_trainees(id) on delete cascade,
    taken_at    timestamptz not null default now(),
    category    text,
    score       int not null check (score >= 0),
    total       int not null check (total > 0 and score <= total),
    details     jsonb not null default '[]'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists idx_kb_results_trainee on kb_results(trainee_id);

/** A change to what a guide says makes it a new version. */
create or replace function fn_kb_guide_version() returns trigger language plpgsql as $$
begin
    if (new.title, new.category, new.purpose, new.summary, new.steps, new.tips, new.safety, new.troubles)
       is distinct from (old.title, old.category, old.purpose, old.summary, old.steps, old.tips, old.safety, old.troubles) then
        new.version := old.version + 1;
    end if;
    return new;
end $$;
drop trigger if exists trg_kb_guide_version on kb_guides;
create trigger trg_kb_guide_version before update on kb_guides
    for each row execute function fn_kb_guide_version();

select _spir_attach_change_log();
select _spir_guard_triggers();
