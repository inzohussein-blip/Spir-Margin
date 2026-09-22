-- =====================================================================
-- Migration 0102 : Arabic for every error the database raises
--
-- 108 `raise exception` messages in the live functions were English — "Cart
-- is empty.", "Insufficient stock for %: % available, % needed", "Payment
-- exceeds outstanding (% remaining)". Many actions hand error.message to the
-- screen as it is (the POS, for one), so a cashier met them word for word;
-- the others passed through a generic translation that kept the Arabic but
-- dropped the numbers that made the message useful. Translating at the
-- source fixes both, everywhere, including the sync-refusal log.
--
-- Same mechanism as 0091: each function is rewritten from its own current
-- definition, so nothing here restates (or can drift from) the function
-- bodies. Every `%` placeholder keeps its position and order — PL/pgSQL
-- refuses a RAISE whose placeholders do not match its arguments, so a slip
-- would stop this migration rather than ship. Re-runnable: once the English
-- literals are gone the replacements no-op.
--
-- tests/arabic-errors.test.mjs fails if an English message ever comes back.
-- =====================================================================

do $$
declare
    pairs text[][] := array[
        -- sync and audit internals (shown to admins in Monitoring)
        ['unknown table %', 'جدول غير معروف: %'],
        ['table % has no primary key', 'الجدول % بلا مفتاح أساسي'],
        ['audit_log is append-only; % is not permitted', 'سجلّ التدقيق للإضافة فقط؛ لا يُسمح بـ %'],
        -- landed cost
        ['Landed cost voucher % not found', 'قسيمة تكلفة الوصول % غير موجودة'],
        ['Voucher % is already applied', 'القسيمة % مُطبَّقة مسبقاً'],
        ['Receipt % must be received before landed costs can be applied', 'يجب استلام الإيصال % قبل تطبيق تكاليف الوصول'],
        ['Voucher % has no extra cost to allocate', 'القسيمة % بلا تكاليف إضافية لتوزيعها'],
        ['Receipt % has no stockable items to allocate onto', 'الإيصال % لا يحوي أصنافاً مخزنية لتوزيع التكلفة عليها'],
        -- blanket orders
        ['Blanket order line % not found', 'سطر الاتفاقية الإطارية % غير موجود'],
        ['Draw-down qty must be positive', 'كمية السحب يجب أن تكون أكبر من صفر'],
        ['Draw-down exceeds agreed qty (remaining %)', 'كمية السحب تتجاوز الكمية المتّفق عليها (المتبقّي %)'],
        ['Blanket order % not found', 'الاتفاقية الإطارية % غير موجودة'],
        ['Blanket order % is not a draft', 'الاتفاقية الإطارية % ليست مسودّة'],
        ['Blanket order % has no items', 'الاتفاقية الإطارية % بلا أصناف'],
        -- selling
        ['Pick a lab', 'اختر مختبراً'],
        ['Add at least one line', 'أضف سطراً واحداً على الأقل'],
        ['Cannot return more than sold for %: sold %, already returned %, tried to return %',
         'لا يمكن إرجاع أكثر ممّا بيع من %: المُباع %، والمُرجَع سابقاً %، والمطلوب إرجاعه %'],
        ['Sales order not found', 'أمر البيع غير موجود'],
        ['Sales order already delivered', 'أمر البيع مُسلَّم مسبقاً'],
        ['Sales order is cancelled', 'أمر البيع ملغى'],
        ['Sales order % not found', 'أمر البيع % غير موجود'],
        ['Quotation not found', 'عرض السعر غير موجود'],
        ['Quotation already ordered', 'صدر بعرض السعر أمر بيع مسبقاً'],
        ['Lead not found', 'العميل المحتمل غير موجود'],
        ['Lead already converted', 'العميل المحتمل مُحوَّل مسبقاً'],
        ['Delivery note not found', 'مذكّرة التسليم غير موجودة'],
        ['Already delivered', 'مُسلَّمة مسبقاً'],
        ['Delivery note is cancelled', 'مذكّرة التسليم ملغاة'],
        -- point of sale and stock
        ['Missing request id', 'معرّف الطلب مفقود'],
        ['Select a customer (lab).', 'اختر الزبون (المختبر).'],
        ['Customer not found.', 'الزبون غير موجود.'],
        ['A product in the cart is invalid.', 'أحد أصناف السلة غير صالح.'],
        ['Quantity must be greater than zero.', 'يجب أن تكون الكمية أكبر من صفر.'],
        ['Sell price cannot be negative.', 'لا يمكن أن يكون سعر البيع سالباً.'],
        ['A product in the cart no longer exists.', 'أحد أصناف السلة لم يعد موجوداً.'],
        ['A product in the cart is disabled.', 'أحد أصناف السلة معطَّل.'],
        ['Cart is empty.', 'السلة فارغة.'],
        ['Insufficient stock for %: % available, % needed', 'الكمية غير كافية من %: المتوفّر % والمطلوب %'],
        ['Stock entry % not found', 'حركة المخزون % غير موجودة'],
        ['Stock entry % already submitted', 'حركة المخزون % مُعتمَدة مسبقاً'],
        ['Stock entry % is cancelled', 'حركة المخزون % ملغاة'],
        ['Batch % has only % available, cannot issue %', 'الدفعة % لا يتوفّر منها سوى %، فلا يمكن صرف %'],
        ['Reconciliation not found', 'جرد المخزون غير موجود'],
        ['Already posted', 'مُرحَّل مسبقاً'],
        ['Pick list % not found', 'قائمة الانتقاء % غير موجودة'],
        ['Pick list % already completed', 'قائمة الانتقاء % مُكتملة مسبقاً'],
        ['Pick list % is cancelled', 'قائمة الانتقاء % ملغاة'],
        ['Pick list % is not a draft', 'قائمة الانتقاء % ليست مسودّة'],
        ['Pick list % has no items', 'قائمة الانتقاء % بلا أصناف'],
        ['Delivery trip % not found', 'رحلة التوصيل % غير موجودة'],
        ['Delivery trip % already completed', 'رحلة التوصيل % مُكتملة مسبقاً'],
        ['Delivery trip % is cancelled', 'رحلة التوصيل % ملغاة'],
        ['Delivery trip % cannot start from %', 'لا يمكن بدء رحلة التوصيل % من الحالة %'],
        ['Delivery trip % has no stops', 'رحلة التوصيل % بلا محطّات'],
        -- buying
        ['Purchase order % not found', 'أمر الشراء % غير موجود'],
        ['Purchase order % is cancelled', 'أمر الشراء % ملغى'],
        ['Purchase order % is already billed', 'أمر الشراء % مُفوتَر مسبقاً'],
        ['Purchase not found', 'الشراء غير موجود'],
        ['Purchase already received', 'الشراء مُستلَم مسبقاً'],
        ['Purchase is cancelled', 'الشراء ملغى'],
        ['Receipt % not found', 'إيصال الاستلام % غير موجود'],
        ['Receipt % already received', 'إيصال الاستلام % مُستلَم مسبقاً'],
        ['Receipt % is cancelled', 'إيصال الاستلام % ملغى'],
        ['Material request not found', 'طلب المواد غير موجود'],
        ['Material request already ordered', 'صدر بطلب المواد أمر شراء مسبقاً'],
        ['RFQ supplier % not found', 'مورّد طلب عرض السعر % غير موجود'],
        ['This supplier already has a quotation', 'لهذا المورّد عرض سعر مسبقاً'],
        ['Supplier quotation not found', 'عرض سعر المورّد غير موجود'],
        ['Supplier quotation already ordered', 'صدر بعرض سعر المورّد أمر شراء مسبقاً'],
        -- accounting and banking
        ['Journal entry not found', 'القيد المحاسبي غير موجود'],
        ['Journal entry has no amounts', 'القيد المحاسبي بلا مبالغ'],
        ['Journal entry is not balanced (debit % != credit %)', 'القيد غير متوازن (المدين % ≠ الدائن %)'],
        ['Invoice % not found', 'الفاتورة % غير موجودة'],
        ['Invoice % is not open for payment', 'الفاتورة % غير مفتوحة للدفع'],
        ['Payment amount must be positive', 'مبلغ الدفعة يجب أن يكون أكبر من صفر'],
        ['Payment exceeds outstanding (% remaining)', 'الدفعة تتجاوز المبلغ المستحق (المتبقّي %)'],
        ['Payment request % not found', 'طلب الدفع % غير موجود'],
        ['Payment request % already paid', 'طلب الدفع % مدفوع مسبقاً'],
        ['Payment request % is cancelled', 'طلب الدفع % ملغى'],
        ['Payment request % is not a draft', 'طلب الدفع % ليس مسودّة'],
        ['Rate must be positive', 'سعر الصرف يجب أن يكون أكبر من صفر'],
        ['Nothing left to allocate on this transaction', 'لم يبقَ شيء لتخصيصه في هذه الحركة'],
        ['This payment has only % left to allocate', 'بقي من هذه الدفعة % فقط للتخصيص'],
        ['This bank line has only % left to allocate', 'بقي من هذا السطر المصرفي % فقط للتخصيص'],
        -- assets, maintenance, manufacturing
        ['Asset repair % not found', 'إصلاح الأصل % غير موجود'],
        ['Repair % already completed', 'الإصلاح % مُكتمل مسبقاً'],
        ['Repair % is cancelled', 'الإصلاح % ملغى'],
        ['Asset movement % not found', 'حركة الأصل % غير موجودة'],
        ['Asset movement % already submitted', 'حركة الأصل % مُعتمَدة مسبقاً'],
        ['Asset movement % is cancelled', 'حركة الأصل % ملغاة'],
        ['Maintenance schedule % not found', 'جدول الصيانة % غير موجود'],
        ['Schedule % is cancelled', 'الجدول % ملغى'],
        ['Maintenance visit % not found', 'زيارة الصيانة % غير موجودة'],
        ['Visit % already submitted', 'الزيارة % مُعتمَدة مسبقاً'],
        ['Visit % is cancelled', 'الزيارة % ملغاة'],
        ['Installation note % not found', 'مذكّرة التركيب % غير موجودة'],
        ['Installation note % already submitted', 'مذكّرة التركيب % مُعتمَدة مسبقاً'],
        ['Installation note % is cancelled', 'مذكّرة التركيب % ملغاة'],
        ['Work order % not found', 'أمر العمل % غير موجود'],
        ['Work order % already completed', 'أمر العمل % مُكتمل مسبقاً'],
        ['Work order % is cancelled', 'أمر العمل % ملغى']
    ];
    fn record;
    d text;
    i int;
begin
    for fn in
        select p.oid, pg_get_functiondef(p.oid) as def
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.prokind = 'f'
           and p.prosrc ~* 'raise\s+exception'
    loop
        d := fn.def;
        for i in 1 .. array_length(pairs, 1) loop
            -- The quoted form only: a message is replaced where it is a whole
            -- string literal, never inside a longer one.
            d := replace(d, quote_literal(pairs[i][1]), quote_literal(pairs[i][2]));
        end loop;
        if d is distinct from fn.def then
            execute d;
        end if;
    end loop;
end $$;
