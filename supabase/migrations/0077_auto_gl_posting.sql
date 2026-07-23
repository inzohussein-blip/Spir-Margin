-- =====================================================================
-- Migration 0077 : Automatic GL (double-entry) posting from sales & purchases
--
-- Until now `sales` and `purchase_invoices` recorded money but nothing posted
-- to the general ledger (journal_entries), so the books never reflected trade.
--
-- Now each sale posts a balanced, posted journal entry:
--     Dr Accounts Receivable   Cr Sales            (revenue = qty * sell_price)
--     Dr Cost of Goods Sold    Cr Stock In Hand    (cost    = qty * buy_price)
-- and each purchase invoice posts:
--     Dr Stock In Hand         Cr Accounts Payable (total_amount)
--
-- Accounts are resolved from the chart of accounts by type/root (not hardcoded
-- ids). Both posting functions are DEFENSIVE: any error (e.g. the chart isn't
-- set up) is swallowed with a warning, so a GL problem can NEVER break a sale
-- or a purchase. Purchase posting is guarded by gl_posted_at so it posts once.
-- =====================================================================

-- ---- Sales → GL -----------------------------------------------------------
create or replace function fn_post_sale_gl(p_sale_id uuid)
returns void language plpgsql as $$
declare
    v_lab uuid; v_qty numeric; v_buy numeric; v_sell numeric; v_date date;
    v_sell_amt numeric; v_cost_amt numeric;
    v_ar text; v_income text; v_cogs text; v_stock text;
    v_je uuid; v_lines int := 0;
begin
    select lab_id, qty, buy_price, sell_price, sold_at::date
      into v_lab, v_qty, v_buy, v_sell, v_date
      from sales where id = p_sale_id;
    if not found then return; end if;

    v_sell_amt := round(coalesce(v_qty, 0) * coalesce(v_sell, 0), 2);
    v_cost_amt := round(coalesce(v_qty, 0) * coalesce(v_buy, 0), 2);

    select account_name into v_ar     from accounts where account_type = 'Receivable'         and not is_group and not disabled order by account_number limit 1;
    select account_name into v_income from accounts where root_type = 'income'                and not is_group and not disabled order by account_number limit 1;
    select account_name into v_cogs   from accounts where account_type = 'Cost of Goods Sold' and not is_group and not disabled order by account_number limit 1;
    select account_name into v_stock  from accounts where account_type = 'Stock'              and not is_group and not disabled order by account_number limit 1;

    insert into journal_entries (voucher_type, posting_date, user_remark)
      values ('Sales Invoice', coalesce(v_date, current_date), 'Auto GL for sale ' || p_sale_id)
      returning id into v_je;

    if v_ar is not null and v_income is not null and v_sell_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit, party_type, party_lab_id)
          values (v_je, v_ar, v_sell_amt, 0, 'lab', v_lab);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit)
          values (v_je, v_income, 0, v_sell_amt);
        v_lines := v_lines + 2;
    end if;
    if v_cogs is not null and v_stock is not null and v_cost_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_cogs, v_cost_amt, 0);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_stock, 0, v_cost_amt);
        v_lines := v_lines + 2;
    end if;

    if v_lines = 0 then
        delete from journal_entries where id = v_je;
        return;
    end if;
    perform fn_post_journal_entry(v_je);
exception when others then
    raise warning 'Auto GL for sale % skipped: %', p_sale_id, sqlerrm;
    return;
end; $$;

create or replace function trg_sale_gl() returns trigger language plpgsql as $$
begin
    perform fn_post_sale_gl(new.id);
    return new;
end; $$;

drop trigger if exists t_sale_gl on sales;
create trigger t_sale_gl after insert on sales for each row execute function trg_sale_gl();

-- ---- Purchase invoice → GL ------------------------------------------------
alter table purchase_invoices add column if not exists gl_posted_at timestamptz;

create or replace function fn_post_purchase_gl(p_pi_id uuid)
returns void language plpgsql as $$
declare
    v_supplier uuid; v_total numeric; v_date date; v_posted timestamptz;
    v_stock text; v_payable text; v_je uuid;
begin
    select supplier_id, total_amount, posting_date, gl_posted_at
      into v_supplier, v_total, v_date, v_posted
      from purchase_invoices where id = p_pi_id;
    if not found then return; end if;
    if v_posted is not null then return; end if;               -- already posted
    if coalesce(v_total, 0) <= 0 then return; end if;          -- nothing to post yet

    select account_name into v_stock   from accounts where account_type = 'Stock'   and not is_group and not disabled order by account_number limit 1;
    select account_name into v_payable from accounts where account_type = 'Payable' and not is_group and not disabled order by account_number limit 1;
    if v_stock is null or v_payable is null then return; end if;

    insert into journal_entries (voucher_type, posting_date, user_remark)
      values ('Purchase Invoice', coalesce(v_date, current_date), 'Auto GL for purchase ' || p_pi_id)
      returning id into v_je;
    insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_stock, v_total, 0);
    insert into journal_entry_accounts (journal_entry_id, account, debit, credit, party_type, party_company_id)
      values (v_je, v_payable, 0, v_total, 'company', v_supplier);
    perform fn_post_journal_entry(v_je);

    update purchase_invoices set gl_posted_at = now() where id = p_pi_id;
exception when others then
    raise warning 'Auto GL for purchase % skipped: %', p_pi_id, sqlerrm;
    return;
end; $$;

create or replace function trg_purchase_gl() returns trigger language plpgsql as $$
begin
    perform fn_post_purchase_gl(new.id);
    return new;
end; $$;

drop trigger if exists t_purchase_gl on purchase_invoices;
create trigger t_purchase_gl after insert or update on purchase_invoices for each row execute function trg_purchase_gl();
