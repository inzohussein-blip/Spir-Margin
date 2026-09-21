-- =====================================================================
-- Migration 0087 : Arabic master data
--
-- The UI is Arabic-only, but the master data seeded by migrations 0012–0052
-- is English, so every dropdown, chart of accounts and category list read
-- half-translated ("Bank Accounts", "Standard Selling", "Prospecting"…).
--
-- Several of these names are referenced BY NAME rather than by id:
--     accounts.parent_account        -> accounts.account_name
--     customer_groups.default_price_list -> price_lists.price_list_name
-- so each rename updates the referencing column in the same statement order,
-- parents first, to keep the links intact.
--
-- Proper nouns are deliberately left alone: brand names (Roche, Siemens…)
-- and unit symbols (L, mL, kg) are not translated.
--
-- Idempotent: every update matches on the English name, so re-running finds
-- nothing to change.
-- =====================================================================

-- ── Chart of accounts ────────────────────────────────────────────────
-- Rename parents first, repointing children, then the leaves.
do $$
declare
    r record;
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
        -- Repoint children before the parent row itself changes name.
        update accounts set parent_account = pairs[i][2] where parent_account = pairs[i][1];
        update accounts set account_name  = pairs[i][2] where account_name  = pairs[i][1];
    end loop;
end $$;

-- ── Units of measure (symbols stay as-is) ────────────────────────────
update uoms set uom_name = 'عدد'      where uom_name = 'Nos';
update uoms set uom_name = 'علبة'     where uom_name = 'Box';
update uoms set uom_name = 'وحدة'     where uom_name = 'Unit';
update uoms set uom_name = 'حزمة'     where uom_name = 'Pack';
update uoms set uom_name = 'قارورة'   where uom_name = 'Vial';
update uoms set uom_name = 'اختبار'   where uom_name = 'Test';
update uoms set uom_name = 'لتر'      where uom_name = 'Litre';
update uoms set uom_name = 'مليلتر'   where uom_name = 'Millilitre';
update uoms set uom_name = 'كيلوغرام' where uom_name = 'Kg';

-- ── Item groups ─────────────────────────────────────────────────────
update item_groups set name = 'أجهزة'        where name = 'Devices';
update item_groups set name = 'كواشف'        where name = 'Reagents';
update item_groups set name = 'قطع غيار'     where name = 'Spare Parts';
update item_groups set name = 'مستهلكات'     where name = 'Consumables';

-- ── Modes of payment ────────────────────────────────────────────────
update modes_of_payment set name = 'نقداً'        where name = 'Cash';
update modes_of_payment set name = 'حوالة مصرفية' where name = 'Wire Transfer';
update modes_of_payment set name = 'صك'           where name = 'Cheque';
update modes_of_payment set name = 'بطاقة'        where name = 'Card';

-- ── Price lists (customer_groups.default_price_list references these) ─
update customer_groups set default_price_list = 'قائمة البيع القياسية'  where default_price_list = 'Standard Selling';
update customer_groups set default_price_list = 'قائمة الشراء القياسية' where default_price_list = 'Standard Buying';
update price_lists     set price_list_name    = 'قائمة البيع القياسية'  where price_list_name    = 'Standard Selling';
update price_lists     set price_list_name    = 'قائمة الشراء القياسية' where price_list_name    = 'Standard Buying';

-- ── Payment terms ───────────────────────────────────────────────────
update payment_terms set name = 'مستحق عند الاستلام' where name = 'Due on Receipt';
update payment_terms set name = 'صافي 30 يوماً'      where name = 'Net 30';
update payment_terms set name = 'صافي 60 يوماً'      where name = 'Net 60';

-- ── Territories (city names already local) ──────────────────────────
update territories set name = 'كل المناطق' where name = 'All Territories';
update territories set name = 'بغداد'       where name = 'Baghdad';
update territories set name = 'البصرة'      where name = 'Basra';
update territories set name = 'أربيل'       where name = 'Erbil';
update territories set name = 'الموصل'      where name = 'Mosul';

-- ── Customer & supplier groups ──────────────────────────────────────
update customer_groups set name = 'كل مجموعات العملاء' where name = 'All Customer Groups';
update customer_groups set name = 'مختبرات حكومية'     where name = 'Government Labs';
update customer_groups set name = 'مختبرات خاصة'       where name = 'Private Labs';
update customer_groups set name = 'مختبرات مستشفيات'   where name = 'Hospital Labs';

update supplier_groups set name = 'كل مجموعات المورّدين' where name = 'All Supplier Groups';
update supplier_groups set name = 'مصنّعون'              where name = 'Manufacturers';
update supplier_groups set name = 'موزّعون'              where name = 'Distributors';
update supplier_groups set name = 'مورّدون محليون'       where name = 'Local Suppliers';

-- ── Asset categories ────────────────────────────────────────────────
update asset_categories set name = 'محلّلات كيمياء'   where name = 'Chemistry Analyzers';
update asset_categories set name = 'محلّلات دم'       where name = 'Hematology Analyzers';
update asset_categories set name = 'محلّلات مناعية'   where name = 'Immunoassay Analyzers';
update asset_categories set name = 'مجاهر'            where name = 'Microscopes';
update asset_categories set name = 'أجهزة طرد مركزي'  where name = 'Centrifuges';

-- ── Warehouse types ─────────────────────────────────────────────────
update warehouse_types set name = 'مخزون'  where name = 'Stock';
update warehouse_types set name = 'مبرّد'  where name = 'Cold';
update warehouse_types set name = 'عبور'   where name = 'Transit';
update warehouse_types set name = 'مرفوض'  where name = 'Rejected';

-- ── CRM masters ─────────────────────────────────────────────────────
update sales_stages set name = 'استكشاف'        where name = 'Prospecting';
update sales_stages set name = 'تأهيل'          where name = 'Qualification';
update sales_stages set name = 'تحليل الحاجات'  where name = 'Needs Analysis';
update sales_stages set name = 'عرض'            where name = 'Proposal';
update sales_stages set name = 'تفاوض'          where name = 'Negotiation';
update sales_stages set name = 'مغلقة'          where name = 'Closed';

update opportunity_types set name = 'بيع'    where name = 'Sales';
update opportunity_types set name = 'صيانة'  where name = 'Maintenance';
update opportunity_types set name = 'دعم'    where name = 'Support';
update opportunity_types set name = 'تركيب'  where name = 'Installation';

update opportunity_lost_reasons set name = 'السعر مرتفع'   where name = 'Price too high';
update opportunity_lost_reasons set name = 'اختار منافساً' where name = 'Chose competitor';
update opportunity_lost_reasons set name = 'لا ميزانية'    where name = 'No budget';
update opportunity_lost_reasons set name = 'التوقيت'       where name = 'Timing';

-- ── Support masters ─────────────────────────────────────────────────
update issue_types set name = 'عتاد'     where name = 'Hardware';
update issue_types set name = 'برمجيات'  where name = 'Software';
update issue_types set name = 'مستهلك'   where name = 'Consumable';
update issue_types set name = 'تركيب'    where name = 'Installation';

update issue_priorities set name = 'منخفضة'  where name = 'Low';
update issue_priorities set name = 'متوسطة'  where name = 'Medium';
update issue_priorities set name = 'عالية'   where name = 'High';
update issue_priorities set name = 'عاجلة'   where name = 'Urgent';

-- ── Terms & conditions ──────────────────────────────────────────────
update terms_and_conditions
   set title = 'شروط البيع القياسية',
       terms = 'الدفع خلال 30 يوماً. تبقى البضاعة ملكاً لنا حتى سداد كامل الثمن.'
 where title = 'Standard Sales Terms';
