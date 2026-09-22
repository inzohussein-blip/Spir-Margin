-- =====================================================================
-- Migration 0095 : Company identity, and document numbering
--
-- The app is installed at one company, and every document it prints was
-- going out under the name "Spir-Margin" with a placeholder mark. The
-- company's own name, logo, watermark and contact details belong on those
-- pages instead.
--
-- This is deliberately LOCAL. The table is `_spir`-prefixed, which the change
-- log excludes, so a company's identity never syncs onto another machine and
-- a second branch can carry its own letterhead. It is also why the logo is
-- stored here as a data URI rather than in `attachments`: attachments sync,
-- and this must not.
--
-- The counter is local for the same reason, and that is what makes document
-- numbers safe: two machines each numbering REQ-0001 would collide the moment
-- they synced, so the number carries a per-machine prefix from the branding
-- and the sequence is kept per machine.
-- =====================================================================

create table if not exists _spir_branding (
    only_row      boolean primary key default true check (only_row),
    company_name  text,
    tagline       text,
    logo          text,          -- data: URI, shown on screen and in print
    watermark_text text,         -- printed faintly across the page
    watermark_on  boolean not null default false,
    address       text,
    city          text,
    phone         text,
    email         text,
    website       text,
    tax_id        text,
    doc_prefix    text,          -- per machine, so numbers cannot collide
    footer_note   text,          -- a line along the bottom of every document
    updated_at    timestamptz not null default now()
);
insert into _spir_branding (only_row) values (true) on conflict do nothing;

create table if not exists _spir_doc_counter (
    kind text not null,
    year int  not null,
    seq  int  not null default 0,
    primary key (kind, year)
);

/**
 * The next number for a kind of document, as PREFIX-KIND-YYYY-NNNN.
 *
 * Sequential per year so a run of documents reads as a run, and prefixed per
 * machine so two machines never mint the same number. Taking the number and
 * advancing the counter happen in one statement, so two requests at once
 * cannot be handed the same one.
 */
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

    return concat_ws('-', v_prefix, upper(p_kind), v_year::text, lpad(v_seq::text, 4, '0'));
end $$;
