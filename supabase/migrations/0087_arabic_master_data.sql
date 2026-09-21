-- =====================================================================
-- Migration 0087 : Arabic master data
--
-- The UI is Arabic-only, but the master data seeded by migrations 0012–0052
-- is English, so every dropdown, chart of accounts and category list read
-- half-translated ("Bank Accounts", "Standard Selling", "Prospecting"…).
--
-- Several of these names are referenced BY NAME rather than by id:
--     accounts.parent_account            -> accounts.account_name
--     customer_groups.default_price_list -> price_lists.price_list_name
-- so each rename updates the referencing column first, parents before
-- children, to keep the links intact.
--
-- Proper nouns are deliberately left alone: brand names (Roche, Siemens…)
-- and unit symbols (L, mL, kg) are not translated.
--
-- Re-runnable. A plain "rename where the name is still English" is not: the
-- renames free up the English names, so replaying a seed migration re-inserts
-- the English rows, and the next replay of this file collides on the unique
-- name. Every rename therefore goes through translate(), which drops the
-- re-inserted English duplicate when the Arabic row is already there.
-- =====================================================================

-- ── Chart of accounts ────────────────────────────────────────────────
-- Rename parents first, repointing children, then the leaves.
do $$
declare
    pairs text[][] := array[
        ['Application of Funds (Assets)', 'الأصول'],
        ['Source of Funds (Liabilities)', 'الخصوم'],
        ['Income',                        'الإيرادات'],
        ['Expenses',                      'المصروفات'],
        ['Bank Accounts',                 'الحسابات المصرفية'],
        ['Accounts Receivable',           'الذمم المدينة'],
        ['Stock In Hand',                 'المخزون'],
        ['Fixed Assets',                  'الأصول الثابتة'],
        ['Accounts Payable',              'الذمم الدائنة'],
        ['Sales',                         'المبيعات'],
        ['Cost of Goods Sold',            'تكلفة البضاعة المباعة'],
        ['Bank Charges',                  'رسوم مصرفية']
    ];
    i int;
begin
    for i in 1 .. array_length(pairs, 1) loop
        if exists (select 1 from accounts where account_name = pairs[i][2]) then
            -- Arabic row already present: drop the re-seeded English duplicate
            -- instead of colliding on the unique account_name.
            update accounts set parent_account = pairs[i][2] where parent_account = pairs[i][1];
            delete from accounts where account_name = pairs[i][1];
            continue;
        end if;
        -- Repoint children before the parent row itself changes name.
        update accounts set parent_account = pairs[i][2] where parent_account = pairs[i][1];
        update accounts set account_name  = pairs[i][2] where account_name  = pairs[i][1];
    end loop;
end $$;

-- ── Everything else ─────────────────────────────────────────────────
-- One table of translations, applied through a single guard. Rows are
-- (table, name column, English, Arabic).
do $$
declare
    pairs text[][] := array[
        -- Units of measure (the symbols L / mL / kg stay as they are)
        ['uoms', 'uom_name', 'Nos',        'عدد'],
        ['uoms', 'uom_name', 'Box',        'علبة'],
        ['uoms', 'uom_name', 'Unit',       'وحدة'],
        ['uoms', 'uom_name', 'Pack',       'حزمة'],
        ['uoms', 'uom_name', 'Vial',       'قارورة'],
        ['uoms', 'uom_name', 'Test',       'اختبار'],
        ['uoms', 'uom_name', 'Litre',      'لتر'],
        ['uoms', 'uom_name', 'Millilitre', 'مليلتر'],
        ['uoms', 'uom_name', 'Kg',         'كيلوغرام'],

        -- Item groups
        ['item_groups', 'name', 'Devices',     'أجهزة'],
        ['item_groups', 'name', 'Reagents',    'كواشف'],
        ['item_groups', 'name', 'Spare Parts', 'قطع غيار'],
        ['item_groups', 'name', 'Consumables', 'مستهلكات'],

        -- Modes of payment
        ['modes_of_payment', 'name', 'Cash',          'نقداً'],
        ['modes_of_payment', 'name', 'Wire Transfer', 'حوالة مصرفية'],
        ['modes_of_payment', 'name', 'Cheque',        'صك'],
        ['modes_of_payment', 'name', 'Card',          'بطاقة'],

        -- Price lists (customer_groups.default_price_list is repointed below)
        ['price_lists', 'price_list_name', 'Standard Selling', 'قائمة البيع القياسية'],
        ['price_lists', 'price_list_name', 'Standard Buying',  'قائمة الشراء القياسية'],

        -- Payment terms
        ['payment_terms', 'name', 'Due on Receipt', 'مستحق عند الاستلام'],
        ['payment_terms', 'name', 'Net 30',         'صافي 30 يوماً'],
        ['payment_terms', 'name', 'Net 60',         'صافي 60 يوماً'],

        -- Territories (city names are already local)
        ['territories', 'name', 'All Territories', 'كل المناطق'],
        ['territories', 'name', 'Baghdad',         'بغداد'],
        ['territories', 'name', 'Basra',           'البصرة'],
        ['territories', 'name', 'Erbil',           'أربيل'],
        ['territories', 'name', 'Mosul',           'الموصل'],

        -- Customer & supplier groups
        ['customer_groups', 'name', 'All Customer Groups', 'كل مجموعات العملاء'],
        ['customer_groups', 'name', 'Government Labs',     'مختبرات حكومية'],
        ['customer_groups', 'name', 'Private Labs',        'مختبرات خاصة'],
        ['customer_groups', 'name', 'Hospital Labs',       'مختبرات مستشفيات'],
        ['supplier_groups', 'name', 'All Supplier Groups', 'كل مجموعات المورّدين'],
        ['supplier_groups', 'name', 'Manufacturers',       'مصنّعون'],
        ['supplier_groups', 'name', 'Distributors',        'موزّعون'],
        ['supplier_groups', 'name', 'Local Suppliers',     'مورّدون محليون'],

        -- Asset categories
        ['asset_categories', 'name', 'Chemistry Analyzers',   'محلّلات كيمياء'],
        ['asset_categories', 'name', 'Hematology Analyzers',  'محلّلات دم'],
        ['asset_categories', 'name', 'Immunoassay Analyzers', 'محلّلات مناعية'],
        ['asset_categories', 'name', 'Microscopes',           'مجاهر'],
        ['asset_categories', 'name', 'Centrifuges',           'أجهزة طرد مركزي'],

        -- Warehouse types
        ['warehouse_types', 'name', 'Stock',    'مخزون'],
        ['warehouse_types', 'name', 'Cold',     'مبرّد'],
        ['warehouse_types', 'name', 'Transit',  'عبور'],
        ['warehouse_types', 'name', 'Rejected', 'مرفوض'],

        -- CRM masters
        ['sales_stages', 'name', 'Prospecting',    'استكشاف'],
        ['sales_stages', 'name', 'Qualification',  'تأهيل'],
        ['sales_stages', 'name', 'Needs Analysis', 'تحليل الحاجات'],
        ['sales_stages', 'name', 'Proposal',       'عرض'],
        ['sales_stages', 'name', 'Negotiation',    'تفاوض'],
        ['sales_stages', 'name', 'Closed',         'مغلقة'],
        ['opportunity_types', 'name', 'Sales',        'بيع'],
        ['opportunity_types', 'name', 'Maintenance',  'صيانة'],
        ['opportunity_types', 'name', 'Support',      'دعم'],
        ['opportunity_types', 'name', 'Installation', 'تركيب'],
        ['opportunity_lost_reasons', 'name', 'Price too high',   'السعر مرتفع'],
        ['opportunity_lost_reasons', 'name', 'Chose competitor', 'اختار منافساً'],
        ['opportunity_lost_reasons', 'name', 'No budget',        'لا ميزانية'],
        ['opportunity_lost_reasons', 'name', 'Timing',           'التوقيت'],

        -- Support masters
        ['issue_types', 'name', 'Hardware',     'عتاد'],
        ['issue_types', 'name', 'Software',     'برمجيات'],
        ['issue_types', 'name', 'Consumable',   'مستهلك'],
        ['issue_types', 'name', 'Installation', 'تركيب'],
        ['issue_priorities', 'name', 'Low',    'منخفضة'],
        ['issue_priorities', 'name', 'Medium', 'متوسطة'],
        ['issue_priorities', 'name', 'High',   'عالية'],
        ['issue_priorities', 'name', 'Urgent', 'عاجلة']
    ];
    i int;
    taken boolean;
begin
    for i in 1 .. array_length(pairs, 1) loop
        -- A price list is referenced by name, so repoint before renaming.
        if pairs[i][1] = 'price_lists' then
            update customer_groups set default_price_list = pairs[i][4]
             where default_price_list = pairs[i][3];
        end if;

        execute format('select exists (select 1 from %I where %I = $1)', pairs[i][1], pairs[i][2])
           into taken using pairs[i][4];

        if taken then
            -- The Arabic row is already there; this is a replay after a seed
            -- migration re-inserted the English one. Drop the duplicate rather
            -- than collide on the unique name — unless something still points
            -- at it, in which case leaving it is the safe outcome.
            begin
                execute format('delete from %I where %I = $1', pairs[i][1], pairs[i][2])
                  using pairs[i][3];
            exception when foreign_key_violation then
                null;
            end;
        else
            execute format('update %I set %I = $1 where %I = $2',
                           pairs[i][1], pairs[i][2], pairs[i][2])
              using pairs[i][4], pairs[i][3];
        end if;
    end loop;
end $$;

-- ── Terms & conditions (title + body) ───────────────────────────────
update terms_and_conditions
   set title = 'شروط البيع القياسية',
       terms = 'الدفع خلال 30 يوماً. تبقى البضاعة ملكاً لنا حتى سداد كامل الثمن.'
 where title = 'Standard Sales Terms'
   and not exists (select 1 from terms_and_conditions where title = 'شروط البيع القياسية');
