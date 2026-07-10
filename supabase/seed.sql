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
