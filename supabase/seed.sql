-- =====================================================================
-- Seed data for local development / demo
-- Run after migrations 0001-0005.
-- =====================================================================

-- Companies -----------------------------------------------------------
insert into companies (id, name, role, country) values
    ('00000000-0000-0000-0000-0000000000a1', 'Roche Diagnostics', 'parent',   'Switzerland'),
    ('00000000-0000-0000-0000-0000000000a2', 'Siemens Healthineers', 'supplier', 'Germany')
on conflict do nothing;

-- Warehouses ----------------------------------------------------------
insert into warehouses (id, name, city) values
    ('00000000-0000-0000-0000-0000000000b1', 'Main Store - Baghdad', 'Baghdad'),
    ('00000000-0000-0000-0000-0000000000b2', 'Cold Store - Basra',   'Basra')
on conflict do nothing;

-- Labs ----------------------------------------------------------------
insert into labs (id, code, name, status, city, latitude, longitude, contact_name, phone) values
    ('00000000-0000-0000-0000-0000000000c1', 'LAB-001', 'Al-Kindy Teaching Lab', 'active',   'Baghdad', 33.3152, 44.3661, 'Dr. Sara', '0770-000-0001'),
    ('00000000-0000-0000-0000-0000000000c2', 'LAB-002', 'Basra Central Lab',     'active',   'Basra',   30.5085, 47.7835, 'Dr. Omar', '0770-000-0002'),
    ('00000000-0000-0000-0000-0000000000c3', 'LAB-003', 'Mosul Private Lab',     'inactive', 'Mosul',   36.3350, 43.1189, 'Dr. Layla','0770-000-0003')
on conflict do nothing;

-- Products ------------------------------------------------------------
insert into products (id, item_code, name, product_type, brand, uom, supplier_id, shelf_life_in_days, default_buy_price, default_sell_price) values
    ('00000000-0000-0000-0000-0000000000d1', 'DEV-CHEM-01', 'Cobas c311 Chemistry Analyzer', 'device',     'Roche',   'Nos', '00000000-0000-0000-0000-0000000000a1', null, 45000, 60000),
    ('00000000-0000-0000-0000-0000000000d2', 'DEV-HEM-01',  'Sysmex XN-550 Hematology',      'device',     'Siemens', 'Nos', '00000000-0000-0000-0000-0000000000a2', null, 30000, 40000),
    ('00000000-0000-0000-0000-0000000000d3', 'KIT-GLU-01',  'Glucose Reagent Kit (100T)',    'kit',        'Roche',   'Box', '00000000-0000-0000-0000-0000000000a1', 365, 80, 130),
    ('00000000-0000-0000-0000-0000000000d4', 'KIT-CBC-01',  'CBC Reagent Kit (200T)',        'kit',        'Siemens', 'Box', '00000000-0000-0000-0000-0000000000a2', 180, 120, 200),
    ('00000000-0000-0000-0000-0000000000d5', 'SP-PUMP-01',  'Peristaltic Pump Spare',        'spare_part', 'Roche',   'Nos', '00000000-0000-0000-0000-0000000000a1', null, 200, 320)
on conflict do nothing;

-- Devices -------------------------------------------------------------
insert into devices (asset_code, product_id, serial_no, status, lab_id, purchase_date, purchase_price, maintenance_required, next_maintenance_date) values
    ('ACC-ASS-0001', '00000000-0000-0000-0000-0000000000d1', 'C311-778812', 'installed',      '00000000-0000-0000-0000-0000000000c1', '2024-03-10', 45000, true, current_date + 12),
    ('ACC-ASS-0002', '00000000-0000-0000-0000-0000000000d2', 'XN-550-4471', 'in_maintenance', '00000000-0000-0000-0000-0000000000c2', '2023-11-01', 30000, true, current_date - 3),
    ('ACC-ASS-0003', '00000000-0000-0000-0000-0000000000d1', 'C311-778813', 'installed',      '00000000-0000-0000-0000-0000000000c1', '2024-06-20', 45000, true, current_date + 200),
    ('ACC-ASS-0004', '00000000-0000-0000-0000-0000000000d2', 'XN-550-4472', 'out_of_order',   '00000000-0000-0000-0000-0000000000c3', '2022-09-15', 30000, false, null)
on conflict do nothing;

-- Kit batches ---------------------------------------------------------
insert into kit_batches (batch_no, product_id, warehouse_id, supplier_id, manufacturing_date, expiry_date, qty_received, qty_available, buy_price, sell_price) values
    ('B-GLU-2401', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '2025-06-01', current_date + 20,  100, 60, 80, 130),
    ('B-GLU-2402', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '2025-08-01', current_date + 120, 100, 95, 80, 130),
    ('B-CBC-2401', '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', '2025-05-15', current_date + 55,  80,  40, 120, 200)
on conflict do nothing;

-- Sales (drives profit KPI) ------------------------------------------
insert into sales (lab_id, product_id, qty, buy_price, sell_price, sold_at) values
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3', 40, 80,  130, now() - interval '10 days'),
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 1,  45000, 60000, now() - interval '40 days'),
    ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d4', 30, 120, 200, now() - interval '5 days')
on conflict do nothing;

-- Stock movements / withdrawals (drives lab active state) ------------
insert into stock_movements (kit_batch_id, lab_id, type, qty, buy_price, sell_price, moved_at)
select b.id, '00000000-0000-0000-0000-0000000000c1', 'withdrawal', 5, b.buy_price, b.sell_price, now() - interval '3 days'
from kit_batches b where b.batch_no = 'B-GLU-2401'
on conflict do nothing;

-- =====================================================================
-- Banking demo data (migrations 0007-0009)
-- =====================================================================
insert into bank_accounts (id, account_name, bank, account_type, account_no, currency, is_company_account) values
    ('00000000-0000-0000-0000-0000000000e1', 'Main Operating', 'Trade Bank of Iraq', 'Current', '0011-2233', 'USD', true)
on conflict do nothing;

-- a received payment from a lab, awaiting a matching bank line
insert into payment_entries (id, naming_series, payment_type, party_type, party_lab_id, party_name, received_amount, bank_account_id, reference_no, posting_date) values
    ('00000000-0000-0000-0000-0000000000f1', 'ACC-PAY-0001', 'receive', 'lab', '00000000-0000-0000-0000-0000000000c1', 'Al-Kindy Teaching Lab', 5200, '00000000-0000-0000-0000-0000000000e1', 'WIRE-778', current_date - 2),
    ('00000000-0000-0000-0000-0000000000f2', 'ACC-PAY-0002', 'pay',     'company', null, 'Roche Diagnostics', 0, '00000000-0000-0000-0000-0000000000e1', 'PO-5521', current_date - 6)
on conflict do nothing;
update payment_entries set paid_amount = 3100 where id = '00000000-0000-0000-0000-0000000000f2';

-- imported bank statement lines
insert into bank_transactions (id, date, bank_account_id, deposit, withdrawal, description, reference_number, transaction_id) values
    ('00000000-0000-0000-0000-0000000000d1', current_date - 2, '00000000-0000-0000-0000-0000000000e1', 5200, 0, 'INWARD WIRE AL-KINDY LAB', 'WIRE-778', 'BNK-1001'),
    ('00000000-0000-0000-0000-0000000000d2', current_date - 6, '00000000-0000-0000-0000-0000000000e1', 0, 3100, 'OUTWARD ROCHE DIAGNOSTICS', 'PO-5521', 'BNK-1002'),
    ('00000000-0000-0000-0000-0000000000d3', current_date - 1, '00000000-0000-0000-0000-0000000000e1', 0, 90,  'CARD FEE BANK CHARGES',     null,      'BNK-1003')
on conflict do nothing;

-- a matching rule: bank charges -> classify as bank entry
insert into bank_transaction_rules (id, rule_name, transaction_type, priority, classify_as) values
    ('00000000-0000-0000-0000-0000000000c9', 'Bank charges', 'withdrawal', 1, 'bank_entry')
on conflict do nothing;
insert into bank_rule_conditions (rule_id, field, operator, value) values
    ('00000000-0000-0000-0000-0000000000c9', 'description', 'contains', 'BANK CHARGES')
on conflict do nothing;

-- Demo receivables + procurement (drives the dashboard operations panels) ----
do $$
declare v_lab uuid; v_prod uuid; v_inv uuid; v_sup uuid; v_po uuid;
begin
    select id into v_lab from labs where code = 'LAB-001';
    select id into v_prod from products where product_type = 'kit' limit 1;
    select id into v_sup from companies limit 1;

    -- a partly-paid invoice -> shows under Outstanding Receivables
    if v_lab is not null and v_prod is not null
       and not exists (select 1 from sales_invoices where invoice_no = 'SI-2601') then
        insert into sales_invoices (invoice_no, lab_id) values ('SI-2601', v_lab) returning id into v_inv;
        insert into sales_invoice_items (invoice_id, product_id, qty, rate) values (v_inv, v_prod, 20, 130);
        perform fn_submit_sales_invoice(v_inv);
        perform fn_record_invoice_payment(v_inv, 1000);   -- 2600 billed, 1600 outstanding
    end if;

    -- an unpaid invoice
    if v_lab is not null and v_prod is not null
       and not exists (select 1 from sales_invoices where invoice_no = 'SI-2602') then
        insert into sales_invoices (invoice_no, lab_id) values ('SI-2602', v_lab) returning id into v_inv;
        insert into sales_invoice_items (invoice_id, product_id, qty, rate) values (v_inv, v_prod, 8, 130);
        perform fn_submit_sales_invoice(v_inv);
    end if;

    -- a submitted purchase order -> shows under Open Purchase Orders
    if v_sup is not null and v_prod is not null
       and not exists (select 1 from purchase_orders where po_no = 'PO-2601') then
        insert into purchase_orders (po_no, supplier_id) values ('PO-2601', v_sup) returning id into v_po;
        insert into purchase_order_items (po_id, product_id, qty, rate) values (v_po, v_prod, 50, 80);
        perform fn_submit_purchase_order(v_po);
    end if;
end $$;

-- Demo preventive-maintenance schedule (drives the dashboard PM panel) -------
do $$
declare v_dev uuid; v_lab uuid; v_sched uuid;
begin
    select id, lab_id into v_dev, v_lab from devices order by asset_code limit 1;
    if v_dev is not null and not exists (select 1 from maintenance_schedules where schedule_no = 'MS-DEMO-1') then
        insert into maintenance_schedules (schedule_no, lab_id, device_id, periodicity, start_date, no_of_visits)
        values ('MS-DEMO-1', v_lab, v_dev, 'monthly', current_date + 10, 6)
        returning id into v_sched;
        perform fn_generate_maintenance_schedule(v_sched);
    end if;
end $$;

-- Demo support issue -------------------------------------------------------
do $$
declare v_lab uuid; v_dev uuid;
begin
    select id, (select id from devices where lab_id = labs.id limit 1)
      into v_lab, v_dev from labs where code = 'LAB-001';
    if v_lab is not null and not exists (select 1 from issues where issue_no = 'ISS-0001') then
        insert into issues (issue_no, subject, lab_id, device_id, status, priority, issue_type, description)
        values ('ISS-0001', 'Analyzer shows error E-14 on startup', v_lab, v_dev,
                'open', 'High', 'Hardware', 'Device fails self-test intermittently.');
    end if;
end $$;

-- Demo service contract (drives the dashboard 'Expiring contracts' card) -----
do $$
declare v_lab uuid; v_dev uuid;
begin
    select id, (select id from devices where lab_id = labs.id limit 1)
      into v_lab, v_dev from labs where code = 'LAB-001';
    if v_lab is not null and not exists (select 1 from contracts where contract_no = 'AMC-2601') then
        insert into contracts (contract_no, lab_id, device_id, status, start_date, end_date, contract_value, signee, signed_on, contract_terms)
        values ('AMC-2601', v_lab, v_dev, 'active', current_date - 305, current_date + 30, 2400,
                'Dr. Sara', current_date - 305, 'Annual maintenance: 2 preventive visits + breakdown support.');
    end if;
end $$;

-- Demo RFQ with two suppliers -----------------------------------------------
do $$
declare v_prod uuid; v_rfq uuid; v_s1 uuid; v_s2 uuid;
begin
    select id into v_prod from products where product_type='kit' limit 1;
    select id into v_s1 from companies order by name limit 1;
    select id into v_s2 from companies order by name offset 1 limit 1;
    if v_prod is not null and v_s1 is not null and not exists (select 1 from rfqs where rfq_no='RFQ-2601') then
        insert into rfqs (rfq_no, status, message) values ('RFQ-2601','submitted','Please quote your best price + lead time.') returning id into v_rfq;
        insert into rfq_items (rfq_id, product_id, qty) values (v_rfq, v_prod, 100);
        insert into rfq_suppliers (rfq_id, supplier_id) values (v_rfq, v_s1);
        if v_s2 is not null then insert into rfq_suppliers (rfq_id, supplier_id) values (v_rfq, v_s2); end if;
    end if;
end $$;

-- Demo appointment ----------------------------------------------------------
do $$
declare v_lab uuid; v_dev uuid;
begin
    select id, (select id from devices where lab_id = labs.id limit 1)
      into v_lab, v_dev from labs where code = 'LAB-001';
    if v_lab is not null and not exists (select 1 from appointments where appointment_no = 'APT-2601') then
        insert into appointments (appointment_no, lab_id, device_id, purpose, scheduled_time, status, contact_name)
        values ('APT-2601', v_lab, v_dev, 'service', now() + interval '3 days', 'confirmed', 'Dr. Sara');
    end if;
end $$;

-- Demo maintenance team + members + tasks -----------------------------------
do $$
declare v_team uuid;
begin
    if not exists (select 1 from maintenance_teams where name = 'Field Service Team') then
        insert into maintenance_teams (name, manager_name, description)
        values ('Field Service Team', 'Eng. Kareem', 'Handles installs, PM visits and breakdowns.')
        returning id into v_team;
        insert into maintenance_team_members (team_id, member_name, role) values
            (v_team, 'Eng. Kareem', 'Manager'),
            (v_team, 'Tech. Omar', 'Technician'),
            (v_team, 'Tech. Lina', 'Technician');
        insert into maintenance_tasks (team_id, task_name, maintenance_type, periodicity, start_date, status) values
            (v_team, 'Quarterly PM checklist', 'preventive', 'Quarterly', current_date, 'planned'),
            (v_team, 'Annual calibration', 'calibration', 'Yearly', current_date, 'planned');
    end if;
end $$;

-- Demo credit limit (LAB-001 has invoices ~2640 outstanding; set a low limit) -
update labs set credit_limit = 2000 where code = 'LAB-001';

-- Demo pricing rule: 10% off any kit when qty >= 50 --------------------------
do $$
declare v_prod uuid;
begin
    select id into v_prod from products where product_type='kit' limit 1;
    if not exists (select 1 from pricing_rules where title='Bulk kit 10%') then
        insert into pricing_rules (title, product_id, min_qty, discount_percentage)
        values ('Bulk kit 10%', v_prod, 50, 10);
    end if;
end $$;

-- Demo purchase receipt (received into stock) --------------------------------
do $$
declare v_sup uuid; v_prod uuid; v_wh uuid; v_r uuid;
begin
    select id into v_sup from companies limit 1;
    select id into v_prod from products where product_type='kit' limit 1;
    select id into v_wh from warehouses limit 1;
    if v_prod is not null and not exists (select 1 from purchase_receipts where receipt_no='PR-2601') then
        insert into purchase_receipts (receipt_no, supplier_id) values ('PR-2601', v_sup) returning id into v_r;
        insert into purchase_receipt_items (receipt_id, product_id, qty, rate, warehouse_id, batch_no, expiry_date)
        values (v_r, v_prod, 40, 42, v_wh, 'B-PR-2601', current_date + 200);
        perform fn_submit_purchase_receipt(v_r);
    end if;
end $$;

-- Demo payment request (requested against an unpaid invoice) ------------------
do $$
declare v_inv uuid; v_lab uuid; v_out numeric;
begin
    select id, lab_id, outstanding into v_inv, v_lab, v_out
        from sales_invoices where status in ('unpaid','partly_paid') order by outstanding desc limit 1;
    if v_inv is not null and v_out > 0
       and not exists (select 1 from payment_requests where request_no='PREQ-2601') then
        insert into payment_requests (request_no, invoice_id, lab_id, amount, message)
        values ('PREQ-2601', v_inv, v_lab, least(v_out, 500), 'Kindly settle the outstanding balance.');
        perform fn_submit_payment_request((select id from payment_requests where request_no='PREQ-2601'));
    end if;
end $$;

-- Demo blanket order (active selling agreement with a lab) --------------------
do $$
declare v_lab uuid; v_prod uuid; v_sell numeric; v_bo uuid;
begin
    select id into v_lab from labs limit 1;
    select id, default_sell_price into v_prod, v_sell from products where product_type='kit' limit 1;
    if v_lab is not null and v_prod is not null
       and not exists (select 1 from blanket_orders where order_no='BO-2601') then
        insert into blanket_orders (order_no, order_type, lab_id, to_date, notes)
        values ('BO-2601', 'selling', v_lab, current_date + 365, 'Annual reagent-kit supply agreement.')
        returning id into v_bo;
        insert into blanket_order_items (order_id, product_id, qty, rate)
        values (v_bo, v_prod, 500, coalesce(nullif(v_sell,0), 60));
        perform fn_submit_blanket_order(v_bo);
    end if;
end $$;

-- Demo pick list (open, released to the floor) -------------------------------
do $$
declare v_lab uuid; v_prod uuid; v_wh uuid; v_pl uuid;
begin
    select id into v_lab from labs limit 1;
    select id into v_prod from products where product_type='kit' limit 1;
    select id into v_wh from warehouses limit 1;
    if v_prod is not null and not exists (select 1 from pick_lists where pick_no='PICK-2601') then
        insert into pick_lists (pick_no, lab_id, purpose) values ('PICK-2601', v_lab, 'delivery')
        returning id into v_pl;
        insert into pick_list_items (pick_id, product_id, warehouse_id, qty, batch_no)
        values (v_pl, v_prod, v_wh, 12, 'B-PR-2601');
        perform fn_open_pick_list(v_pl);
    end if;
end $$;

-- Demo delivery trip (in transit, one stop) ----------------------------------
do $$
declare v_lab uuid; v_dn uuid; v_trip uuid;
begin
    select id into v_lab from labs limit 1;
    select id into v_dn from delivery_notes order by posting_date desc limit 1;
    if not exists (select 1 from delivery_trips where trip_no='TRIP-2601') then
        insert into delivery_trips (trip_no, driver_name, vehicle)
        values ('TRIP-2601', 'Ahmed K.', 'Van 12-A') returning id into v_trip;
        insert into delivery_trip_stops (trip_id, lab_id, delivery_note_id, address, seq)
        values (v_trip, v_lab, v_dn, 'Central district, main road', 1);
        perform fn_start_delivery_trip(v_trip);
    end if;
end $$;
