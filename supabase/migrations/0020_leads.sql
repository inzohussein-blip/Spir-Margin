-- =====================================================================
-- Migration 0020 : Lead (CRM)
--
-- Ported from ERPNext "Lead" — a prospective lab (sales pipeline) before it
-- becomes an active lab/customer. Can be converted to a lab.
-- =====================================================================

do $$ begin
    create type lead_status as enum
        ('lead','open','replied','opportunity','quotation','interested',
         'converted','do_not_contact');
exception when duplicate_object then null; end $$;

create table if not exists leads (
    id             uuid primary key default gen_random_uuid(),
    lead_name      text not null,
    company_name   text,
    status         lead_status not null default 'lead',
    email          text,
    phone          text,
    mobile_no      text,
    territory      text,
    industry       text,
    city           text,
    country        text,
    source         text,
    qualification_status text,
    -- once converted, points at the created lab
    converted_lab_id uuid references labs(id) on delete set null,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_leads_status on leads(status);

-- Convert a lead into an active lab and mark it converted.
create or replace function fn_convert_lead(p_lead_id uuid, p_code text)
returns uuid
language plpgsql
as $$
declare v_lead leads%rowtype; v_lab uuid;
begin
    select * into v_lead from leads where id = p_lead_id;
    if not found then raise exception 'Lead not found'; end if;
    if v_lead.converted_lab_id is not null then raise exception 'Lead already converted'; end if;

    insert into labs (code, name, status, city, territory, contact_name, phone, email)
    values (p_code, coalesce(v_lead.company_name, v_lead.lead_name), 'active',
            v_lead.city, v_lead.territory, v_lead.lead_name, coalesce(v_lead.mobile_no, v_lead.phone), v_lead.email)
    returning id into v_lab;

    update leads set status = 'converted', converted_lab_id = v_lab, updated_at = now()
     where id = p_lead_id;
    return v_lab;
end;
$$;

alter table leads enable row level security;
drop policy if exists "authenticated_all" on leads;
create policy "authenticated_all" on leads
    for all to authenticated using (true) with check (true);
