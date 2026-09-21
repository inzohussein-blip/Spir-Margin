-- =====================================================================
-- Trial seed — the FREE TRIAL platform only.
--
-- Deliberately small: one supplier, two labs, one warehouse, three
-- products, two devices, two kit batches and three sales. Enough for the
-- dashboard KPIs, the lab/device/kit lists and the profit calculation to
-- show real numbers, without the full ERP fixture in `seed.sql`.
--
-- Loaded by `initSchema(run, "trial")` in src/lib/db/pglite.ts. The full
-- platform never sees this file.
-- =====================================================================

-- Supplier we buy from -------------------------------------------------
insert into companies (id, name, role, country) values
    ('00000000-0000-0000-0000-00000000de01'::uuid, 'شركة التشخيص التجريبية', 'parent', 'ألمانيا')
on conflict do nothing;

-- One warehouse --------------------------------------------------------
insert into warehouses (id, name, city) values
    ('00000000-0000-0000-0000-00000000de11'::uuid, 'المخزن التجريبي', 'بغداد')
on conflict do nothing;

-- Two labs (one active, one inactive) ----------------------------------
insert into labs (id, code, name, status, city, contact_name, phone) values
    ('00000000-0000-0000-0000-00000000de21'::uuid, 'LAB-001', 'المختبر المركزي التجريبي', 'active',   'بغداد', 'د. سارة', '0770-000-0001'),
    ('00000000-0000-0000-0000-00000000de22'::uuid, 'LAB-002', 'مختبر الفرع التجريبي',  'inactive', 'البصرة',   'د. عمر', '0770-000-0002')
on conflict do nothing;

-- Three products: one device, one kit, one spare part ------------------
insert into products (id, item_code, name, product_type, brand, uom, supplier_id, shelf_life_in_days, default_buy_price, default_sell_price) values
    ('00000000-0000-0000-0000-00000000de31'::uuid, 'DEV-01', 'محلّل كيمياء تجريبي', 'device',     'تجريبي', 'عدد', '00000000-0000-0000-0000-00000000de01'::uuid, null, 20000, 26000),
    ('00000000-0000-0000-0000-00000000de32'::uuid, 'KIT-01', 'كِت كواشف تجريبي (100 اختبار)', 'kit',        'تجريبي', 'علبة', '00000000-0000-0000-0000-00000000de01'::uuid, 365,     50,    90),
    ('00000000-0000-0000-0000-00000000de33'::uuid, 'SPR-01', 'مسبار عيّنات تجريبي',       'spare_part', 'تجريبي', 'عدد', '00000000-0000-0000-0000-00000000de01'::uuid, null,   300,   450)
on conflict do nothing;

-- Two devices: one healthy, one with maintenance due soon --------------
insert into devices (asset_code, product_id, serial_no, status, lab_id, purchase_date, purchase_price, maintenance_required, next_maintenance_date) values
    ('DEMO-0001', '00000000-0000-0000-0000-00000000de31'::uuid, 'DEMO-1001', 'installed', '00000000-0000-0000-0000-00000000de21'::uuid, current_date - 300, 20000, true, current_date + 10),
    ('DEMO-0002', '00000000-0000-0000-0000-00000000de31'::uuid, 'DEMO-1002', 'installed', '00000000-0000-0000-0000-00000000de22'::uuid, current_date - 120, 20000, true, current_date + 180)
on conflict do nothing;

-- Two kit batches: one expiring soon, one comfortable ------------------
insert into kit_batches (batch_no, product_id, warehouse_id, supplier_id, manufacturing_date, expiry_date, qty_received, qty_available, buy_price, sell_price) values
    ('DEMO-B-01', '00000000-0000-0000-0000-00000000de32'::uuid, '00000000-0000-0000-0000-00000000de11'::uuid, '00000000-0000-0000-0000-00000000de01'::uuid, current_date - 120, current_date + 25,  60, 35, 50, 90),
    ('DEMO-B-02', '00000000-0000-0000-0000-00000000de32'::uuid, '00000000-0000-0000-0000-00000000de11'::uuid, '00000000-0000-0000-0000-00000000de01'::uuid, current_date - 30,  current_date + 300, 60, 60, 50, 90)
on conflict do nothing;

-- Three sales, so the profit KPI (sell - buy) x qty has something to show
insert into sales (lab_id, product_id, qty, buy_price, sell_price, sold_at) values
    ('00000000-0000-0000-0000-00000000de21'::uuid, '00000000-0000-0000-0000-00000000de32'::uuid, 25, 50,    90,    now() - interval '6 days'),
    ('00000000-0000-0000-0000-00000000de21'::uuid, '00000000-0000-0000-0000-00000000de31'::uuid, 1,  20000, 26000, now() - interval '30 days'),
    ('00000000-0000-0000-0000-00000000de22'::uuid, '00000000-0000-0000-0000-00000000de33'::uuid, 4,  300,   450,   now() - interval '3 days')
on conflict do nothing;
