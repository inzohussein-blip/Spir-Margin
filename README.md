# Spir-Margin — إدارة الأجهزة الطبية والمختبرات

برنامج لشركة واحدة في العراق تبيع الأجهزة الطبية وكِتّات الكواشف وقطع الغيار للمختبرات:
المبيعات والمشتريات، والمخزون بدُفعاته وتواريخ انتهائه، والأجهزة المركّبة لدى المختبرات
وصيانتها، والبنوك والتسوية المصرفية، والتقارير — **بالعربية كاملاً، ويعمل دون إنترنت**.

- **التقنية:** Next.js 14 (App Router) + Tailwind CSS.
- **قاعدة البيانات:** Postgres مدمج (PGlite) على كل حاسوب — لا خادم خارجي ولا إعداد.
- **المزامنة:** بين حواسيب المكتب عبر الشبكة المحلية، وبين الفروع عبر قاعدة مستضافة (Supabase).
- **التثبيت:** نقرة مزدوجة على `install-windows.cmd` في ويندوز (وسكربت systemd في لينكس).

> ملف [`CLAUDE.md`](./CLAUDE.md) هو الخريطة نفسها مختصرةً بالإنجليزية لمساعد البرمجة Claude.
> هذا الملف هو الشرح المفصّل.

## المحتويات

1. [كيف يعمل](#1-كيف-يعمل)
2. [التشغيل للمطوّر](#2-التشغيل-للمطوّر)
3. [خريطة المجلّدات](#3-خريطة-المجلّدات)
4. [خريطة الصفحات: كل قسم ومكانه](#4-خريطة-الصفحات-كل-قسم-ومكانه)
5. [الخواص الأساسية وأين ملفّاتها](#5-الخواص-الأساسية-وأين-ملفّاتها)
6. [المزامنة بالتفصيل](#6-المزامنة-بالتفصيل)
7. [قاعدة البيانات والـ migrations](#7-قاعدة-البيانات-والـ-migrations)
8. [الأمان](#8-الأمان)
9. [الاختبارات](#9-الاختبارات)
10. [الوثائق الأخرى](#10-الوثائق-الأخرى)
11. [قواعد لا تُكسر](#11-قواعد-لا-تُكسر)

---

## 1) كيف يعمل

```
المتصفّح ── Next.js على هذا الحاسوب فقط (127.0.0.1:3000)
               │
               ├─ الصفحات (Server Components) + الإجراءات (Server Actions)
               │     └─ src/lib/supabase/server.ts  ← عملاء البيانات الأربعة
               │           └─ src/lib/db/rest.ts    ← مُنشئ استعلامات بشكل supabase-js، وفيه فحص الصلاحية لكل استعلام
               │                 └─ src/lib/db/pglite.ts ← قاعدة Postgres المدمجة (.pglite-data)، الـ migrations، النسخ والاستعادة
               │
               ├─ عمل الخلفية (src/instrumentation-node.ts): مزامنة كل دقيقة، النسخ التلقائي، تنظيف السجلّ،
               │   وخدمة شبكة المكتب على المنفذ 3310 إن كان هذا «الحاسوب الرئيسي»
               │
               └─ منطق العمل كلّه دوال ومشغّلات Postgres في supabase/migrations — نفس الـ SQL محلياً وعلى القاعدة المستضافة
```

- **كل حاسوب يعمل من قاعدته المحلية.** انقطاع الإنترنت لا يوقف شيئاً؛ التغييرات تُسجَّل وتُرسَل حين يعود الاتصال.
- **الحساب الثابت** `admin@spir.local` مكتوب في الكود ويعمل دائماً، حتى على تثبيت جديد بلا شبكة. كلمة مروره 123
  حتى يغيّرها المسؤول من الإعدادات.
- **قاعدة جديدة تبدأ فارغة** لبيانات الشركة الحقيقية. البيانات التجريبية فقط بطلب صريح (`SPIR_SEED=demo`).
- **الواجهة عربية فقط** بأرقام 1234. الإنجليزية موجودة في القاموس لكنها مُعطّلة.

## 2) التشغيل للمطوّر

```bash
npm install
npm run dev          # http://localhost:3000 — تُنشأ ./.pglite-data وتُطبَّق كل الـ migrations
npm run build && npm start
npx tsc --noEmit && npm run lint
npm test             # اختبارات الوحدات (~4 دقائق)
npm run schema       # بعد إضافة migration: يعيد بناء supabase/schema.sql
node scripts/test-browser.mjs [filter]   # اختبارات المتصفّح (~35 دقيقة كاملة)
```

متغيّرات البيئة (في `.env.local`، يُنشأ تلقائياً):

| المتغيّر | المعنى |
| --- | --- |
| `AUTH_SECRET` | مفتاح توقيع الجلسات. يُولَّد تلقائياً لكل تثبيت في `.env.local`. إلزامي على Vercel |
| `SPIR_SEED` | ما تبدأ به قاعدة جديدة: `none` (الافتراضي، فارغة) أو `demo` أو `full` |
| `DATABASE_URL` | اختياري: قاعدة مستضافة للمزامنة (يُفضَّل ضبطها من صفحة المزامنة بدلاً من هذا) |
| `SPIR_TIMEZONE` | اختياري: المنطقة الزمنية (الافتراضي منطقة الحاسوب، ثم Asia/Baghdad) |
| `PGLITE_DATA_DIR` | اختياري: مكان القاعدة المحلية (`memory` = في الذاكرة) |

## 3) خريطة المجلّدات

```
.
├── CLAUDE.md                    خريطة المشروع لمساعد البرمجة (إنجليزية)
├── install-windows.cmd          مثبِّت ويندوز (يستدعي scripts/windows/install.ps1)
├── docs/                        INSTALL · HOSTED-SETUP · DEPLOYMENT · ERPNEXT-PARITY
├── public/                      الأيقونات، offline-sw.js، offline.html
├── scripts/
│   ├── windows/                 install.ps1 · run-server.cmd · run-hidden.vbs · open-app.vbs
│   ├── service/                 install-linux.sh + قالب systemd
│   ├── test-browser.mjs         مشغّل اختبارات المتصفّح
│   ├── build-schema.mjs         يبني supabase/schema.sql من الـ migrations
│   └── verify-admin.mjs         فحص دخول حساب على القاعدة المستضافة (سير عمل يدوي)
├── supabase/
│   ├── migrations/              0001 … 0111 — كل المخطّط ومنطق العمل (انظر القسم 7)
│   ├── schema.sql               مولَّد: كل الـ migrations في ملف واحد
│   └── seed.sql                 البيانات التجريبية (اختيارية)
├── src/
│   ├── middleware.ts            يمنع الزائر غير المسجّل، ويفصل بوّابة الزبائن عن الموظّفين
│   ├── instrumentation*.ts      عمل الخلفية عند تشغيل الخادم
│   ├── app/
│   │   ├── layout.tsx           الإطار: القائمة، الشريط العلوي، فحص صلاحية الجلسة
│   │   ├── page.tsx             لوحة التحكّم
│   │   ├── <قسم>/               صفحة لكل قسم: page.tsx (القائمة)، new/ (إضافة)، [id]/ (تفاصيل)
│   │   ├── actions/             الإجراءات (Server Actions) — ملف لكل مجال
│   │   ├── api/                 backup (تنزيل نسخة)، backup/file، attachments
│   │   ├── login/ welcome/ account/ portal/ pos/ help/ sync/ settings/ …
│   │   └── w/[slug]/            صفحة مجموعة (مساحة عمل) لكل قسم من القائمة
│   ├── components/
│   │   ├── desk/                أدوات القوائم والنماذج: ListShell, FormShell, Pager, Awesomebar (بحث Ctrl K) …
│   │   ├── form/ ui/            حقول النماذج ومكوّنات الواجهة العامّة
│   │   ├── auth/ settings/ sync/ offline/ monitoring/ help/ print/ shortcuts/ …
│   │   └── <مجال>/              مكوّنات خاصّة بكل مجال (banking, selling, stock, …)
│   └── lib/
│       ├── nav.ts               القائمة الجانبية كلّها (المجموعات والصفحات) — مصدر واحد
│       ├── i18n.ts              القاموس العربي + ترجمة الحالات · i18n-server.ts (اللغة دائماً عربية)
│       ├── db/                  pglite.ts (القاعدة)، rest.ts (الاستعلامات)، errors.ts (رسائل عربية)
│       ├── supabase/server.ts   عملاء البيانات وفحص الصلاحية
│       ├── auth/                الجلسات، الحساب الثابت، إنهاء الجلسات، تحديد محاولات الدخول
│       ├── sync/                core (الخوارزمية) · engine · lan (شبكة المكتب) · seal (التشفير) · code (رموز المزامنة)
│       ├── backup/              auto.ts (النسخ التلقائي) · schedule.ts (المواعيد)
│       ├── features.ts          تفعيل/تعطيل/إخفاء الأقسام وصلاحيات كل مستخدم
│       ├── branding.ts          هوية الشركة على المطبوعات
│       └── dates.ts format.ts … أدوات عامّة (التاريخ بتوقيت بغداد، تنسيق الأرقام)
└── tests/                       *.test.mjs (وحدات) · browser/*.mjs (متصفّح)
```

## 4) خريطة الصفحات: كل قسم ومكانه

كل صفحة في `src/app<المسار>/page.tsx`، وإجراءاتها في `src/app/actions/<الملف>`.
القائمة كلّها معرَّفة في `src/lib/nav.ts`. «—» تعني صفحة عرض فقط (تقرير أو سجلّ).

### Home — الرئيسية

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Dashboard — لوحة التحكم | `/` | — |

### Shortcuts — اختصارات

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Sales requests — طلبات البيع | `/sale-requests` | `sale_request.ts` |
| Transport authorisations — تخويلات النقل | `/authorizations` | `authorization.ts` |

### CRM — إدارة العملاء

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Leads — العملاء المحتملون | `/leads` | `crm.ts` |
| Opportunities — الفرص | `/opportunities` | `opportunity.ts` |
| Appointments — المواعيد | `/appointments` | `appointment.ts` |
| Contracts — العقود | `/contracts` | `contract.ts` |

### Selling — المبيعات

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Point of Sale — نقطة البيع | `/pos` | `monitoring.ts`, `pos.ts`, `selling.ts` |
| Labs — المختبرات | `/labs` | `crud.ts` |
| Quotations — عروض الأسعار | `/quotations` | `quotation.ts` |
| Sales Orders — أوامر البيع | `/sales-orders` | `currency.ts`, `monitoring.ts`, `pos.ts`, `selling.ts` |
| Sales Invoices — فواتير البيع | `/sales-invoices` | `attachments.ts`, `currency.ts`, `sales_invoice.ts` |
| Sales Returns — مرتجعات البيع | `/sales-returns` | `sales_return.ts` |
| Blanket Orders — الاتفاقيات الإطارية | `/blanket-orders` | `blanket_order.ts` |
| Credit Limits — حدود الائتمان | `/credit-limits` | `credit.ts` |
| Pricing Rules — قواعد التسعير | `/pricing-rules` | `pricing_rule.ts` |

### Buying — المشتريات

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Suppliers — الموردون | `/companies` | `crud.ts` |
| Reorder — إعادة الطلب | `/reorder` | `reorder.ts` |
| RFQs — طلبات عروض الأسعار | `/rfqs` | `rfq.ts` |
| Purchase Orders — أوامر الشراء | `/purchase-orders` | `attachments.ts`, `purchase_order.ts` |
| Purchase Receipts — سندات الاستلام | `/purchase-receipts` | `purchase_receipt.ts` |
| Purchases — المشتريات | `/purchases` | `purchasing.ts` |
| Landed Costs — التكاليف الإجمالية للاستيراد | `/landed-costs` | `landed_cost.ts` |

### Stock — المخزون

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Products — المنتجات | `/products` | `crud.ts` |
| Bundles — الحزم | `/product-bundles` | `product_bundle.ts` |
| Kits — الكِتّات | `/kits` | `crud.ts` |
| Serials — الأرقام التسلسلية | `/serials` | `serials.ts` |
| Warehouses — المخازن | `/warehouses` | `crud.ts` |
| Stock Entries — حركات المخزون | `/stock-entries` | `stock_entry.ts` |
| Pick Lists — أوراق التجهيز | `/pick-lists` | `pick_list.ts` |
| Delivery Trips — رحلات التوصيل | `/delivery-trips` | `delivery_trip.ts` |
| Stock Balance — رصيد المخزون | `/stock-balance` | — |
| Prices — الأسعار | `/prices` | `pricing.ts` |

### Manufacturing — التصنيع

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| BOMs — قوائم المواد | `/boms` | `manufacturing.ts` |
| Work Orders — أوامر العمل | `/work-orders` | `manufacturing.ts` |
| Quality — الجودة | `/quality-inspections` | `quality.ts` |

### Assets — الأصول

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Devices — الأجهزة | `/devices` | `crud.ts` |
| Movements — التنقلات | `/asset-movements` | `asset_movement.ts` |
| Installations — التركيبات | `/installation-notes` | `installation.ts` |
| Repairs — الإصلاحات | `/asset-repairs` | `asset_repair.ts` |

### Maintenance — الصيانة

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Field Service Board — لوحة الخدمة الميدانية | `/maintenance-board` | `maintenance.ts` |
| Maintenance Forecast — توقّعات الصيانة | `/maintenance-forecast` | — |
| Visits — الزيارات | `/maintenance-visits` | `maintenance.ts` |
| PM Schedules — جداول الصيانة | `/maintenance-schedules` | `maintenance_schedule.ts` |
| Teams — الفرق | `/maintenance-teams` | `maintenance_team.ts` |

### Support — الدعم

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Issues — التذاكر | `/issues` | `attachments.ts`, `support.ts` |
| Warranty — الضمان | `/warranty` | `support.ts` |

### Accounting — المحاسبة

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Payment Requests — طلبات الدفع | `/payment-requests` | `payment_request.ts` |
| AMC Billing — فوترة عقود الصيانة | `/amc-billing` | `amc.ts` |
| Banking — البنوك | `/banking` | `banking.ts` |
| Accounts — الحسابات | `/accounts` | `accounts.ts` |
| Currency — العملات | `/currency` | `currency.ts` |

### Reports — التقارير

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| All Reports — كل التقارير | `/reports` | — |
| Receivables Aging — أعمار الذمم | `/reports/receivables` | — |
| Profitability — الربحية | `/reports/profitability` | — |
| Stock Balance — رصيد المخزون | `/stock-balance` | — |

### Tools — الأدوات

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Calculator — الحاسبة | `/tools/calculator` | — |
| Profit Calculator — حاسبة الأرباح | `/tools/profit` | `currency.ts` |
| Currency Converter — محوّل العملات | `/tools/converter` | `currency.ts` |

### Monitoring — المراقبة

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Error Monitor — مراقبة الأخطاء | `/monitoring/errors` | `monitoring.ts` |
| Change & Deletion Log — سجل التغييرات والحذف | `/monitoring/changes` | — |
| Sync Health — سلامة المزامنة | `/monitoring/sync` | `monitoring.ts`, `pos.ts`, `selling.ts`, `sync.ts` |

### Setup — الإعداد

| الصفحة | المسار | ملفّات الإجراءات |
| --- | --- | --- |
| Masters — البيانات الأساسية | `/masters` | `masters.ts` |
| Users — المستخدمون | `/users` | `users.ts` |
| Settings — الإعدادات | `/settings` | `autobackup.ts`, `backup.ts`, `branding.ts`, `builtin.ts`, `settings.ts` |
| Audit Log — سجل التدقيق | `/audit-log` | — |
| Sync — المزامنة | `/sync` | `links.ts`, `peer.ts`, `sync.ts` |
| Instructions — تعليمات | `/help` | — |

صفحات خارج القائمة: `/login` (الدخول)، `/welcome` (الترحيب)، `/account` (الحساب وتغيير كلمة المرور)،
`/portal` (بوّابة الزبائن)، `/w/<قسم>` (مساحة عمل كل مجموعة)، وصفحات `new/` و`[id]/` تحت كل قائمة.

## 5) الخواص الأساسية وأين ملفّاتها

| الخاصية | الملفّات |
| --- | --- |
| **القائمة الجانبية** | `src/lib/nav.ts` — منها تُبنى القائمة، وتبويب «الخواص» في التعليمات، وصلاحيات الأقسام |
| **الترجمة** | `src/lib/i18n.ts` — كل نص ظاهر يمرّ عبر `t(locale, "مفتاح إنجليزي")` |
| **الدخول والجلسات** | `src/app/actions/auth.ts` · `src/lib/auth/session.ts` (كوكي `spir_session` لسبعة أيام) · `current-user.ts` · `revocation.ts` (إنهاء الجلسة بعد تغيير كلمة المرور أو التعطيل) · `rate-limit.ts` (تحديد المحاولات) · `src/app/login/` |
| **الحساب الثابت (123)** | `src/lib/auth/demo-credentials.ts` · `src/lib/auth/builtin.ts` (كلمة المرور المغيَّرة وملف الاستعادة) · `src/app/actions/builtin.ts` · `components/settings/BuiltinPasswordForm.tsx` |
| **المستخدمون والأدوار** | `src/app/users/` · `src/app/actions/users.ts` · `components/auth/` (إضافة، إعادة تعيين، تغيير كلمة المرور) |
| **تفعيل الأقسام وصلاحياتها** | `src/lib/features.ts` · صفحة الإعدادات |
| **هوية الشركة والطباعة وترقيم المستندات** | `src/lib/branding.ts` · `components/settings/BrandingPanel.tsx` · `components/print/` · الدالة `fn_next_doc_no` |
| **المزامنة (الخوارزمية)** | `src/lib/sync/core.ts` |
| **المزامنة (في البرنامج)** | `src/lib/sync/engine.ts` · `src/app/sync/page.tsx` · `src/app/actions/links.ts` · `components/sync/` |
| **شبكة المكتب** | `src/lib/sync/lan.ts` (المنفذ 3310) · `seal.ts` (التشفير) · `code.ts` (رموز `SPIR1-…`) |
| **القاعدة المستضافة** | `components/settings/PeerPanel.tsx` · `src/app/actions/peer.ts` · `docs/HOSTED-SETUP.md` |
| **حالة المزامنة** | `components/offline/DbSyncStatus.tsx` (الشارة أعلى الشاشة) · `/monitoring/sync` · `components/monitoring/DatabaseSyncPanel.tsx` |
| **العمل دون إنترنت في المتصفّح** | `public/offline-sw.js` · `public/offline.html` · `src/lib/offline/outbox.ts` · `components/offline/` |
| **النسخ الاحتياطي** | يدوي: `src/app/api/backup/route.ts` · `components/settings/BackupPanel.tsx` · `actions/backup.ts` — تلقائي: `src/lib/backup/auto.ts` · `schedule.ts` · `actions/autobackup.ts` · `components/settings/AutoBackupPanel.tsx` — الاستعادة: `restoreLocalDatabase` في `src/lib/db/pglite.ts` |
| **سجلّ التدقيق** | المشغّل `fn_audit` ← الجدول `audit_log` · `src/lib/audit/actor.ts` · `/audit-log` · `/monitoring/changes` |
| **رسائل الأخطاء بالعربية** | `src/lib/db/errors.ts` · `form-error.ts` · الـ migration 0102 |
| **البحث الشامل (Ctrl K)** | `components/desk/Awesomebar.tsx` · `actions/search.ts` · الدالة `fn_global_search` |
| **القوائم والنماذج العامّة** | `src/app/actions/crud.ts` · `components/desk/` · `components/form/` |
| **نقطة البيع** | `/pos` · `components/pos/PosTerminal.tsx` · `actions/pos.ts` |
| **البنوك والتسوية** | `/banking` · `components/banking/` · `actions/banking.ts` · `src/lib/banking.ts` |
| **بوّابة الزبائن** | `/portal` · `actions/portal.ts` · `createPortalClient()` |
| **التعليمات** | `src/app/help/page.tsx` · `components/help/topics.tsx` (كل النصوص) · `parts.tsx` |
| **المثبِّت** | `install-windows.cmd` · `scripts/windows/` · `scripts/service/install-linux.sh` · `docs/INSTALL.md` |

## 6) المزامنة بالتفصيل

- **سجلّ التغييرات:** كل قاعدة تسجّل كل تعديل على صفوفها في `_spir_changes` (من أحدثه، ورقمه، والصف كاملاً).
- **التطبيق:** `_spir_apply_change` يطبّق التغيير «الأحدث يفوز» لكل صف (عبر `_spir_row_version`)، ويُسكت أثناءه
  مشغّلات العمل كلّها (الـ migration 0106)، لأن ما تشتقّه (مثل القيود المحاسبية) يصل في السجلّ نفسه.
- **مصدر واحد لكل حاسوب:** إمّا القاعدة المستضافة، وإمّا «الحاسوب الرئيسي» في المكتب. والحاسوب الرئيسي يخدم
  حواسيب المكتب ويرتبط هو بالقاعدة المستضافة، فتصير شجرة: حواسيب المكتب ← الرئيسي ← المستضافة → الفروع.
- **النقل عبر الوسطاء:** ما يستلمه حاسوب يُسجَّل عنده مع مصدره (`received_from`)، فيُمرّر إلى غيره ولا يُعاد إلى مصدره.
- **الانضمام:** حاسوب فارغ يرتبط بالرئيسي يأخذ نسخة كاملة منه (بهويّة جديدة). وحاسوب غاب أطول مما يحفظه
  الطرف الآخر من سجلّ يأخذ نسخة كاملة من صفوفه الحالية تلقائياً.
- **تعارض الرموز:** إن أنشأ حاسوبان سجلّين بالرمز نفسه، يحتفظ الأسبق برمزه ويأخذ الآخر لاحقة (`LAB-9-A1B2`)،
  ويُسجَّل ذلك في `_spir_sync_renames` ويظهر في «سلامة المزامنة». لا يُغيَّر بريد إلكتروني ولا قيمة تعتمد عليها سجلّات أخرى.
- **شبكة المكتب:** منفذ مستقلّ (3310) لا يجيب إلا على ست عمليات مشفّرة بـ AES-256-GCM بمفتاح من رمز المزامنة
  (hello, pull, push, clone, meta, snap). البرنامج نفسه يبقى مغلقاً أمام الشبكة.
- **التوقيت:** مزامنة كل دقيقة في الخلفية، وزرّ «مزامنة الآن». مزامنة عالقة أكثر من 10 دقائق لا تمنع ما بعدها.

## 7) قاعدة البيانات والـ migrations

- الملفّات في `supabase/migrations` تُطبَّق بالترتيب بواسطة البرنامج نفسه، على القاعدة المحلية وعلى المستضافة عند
  أول اتصال، ويُسجَّل ما طُبّق في `_spir_migrations`. **لا يُستخدم `supabase db push`.**
- **إضافة migration:** الرقم التالي؛ قابلة للتكرار بأمان؛ إن أضافت **جدولاً** تنتهي بـ
  `select _spir_attach_change_log();` وإن أضافت **مشغّلاً** تنتهي بـ `select _spir_guard_triggers();`؛ ثم `npm run schema`.
- **جداول `_spir*` محلية لكل حاسوب ولا تُزامَن:** هويّة الحاسوب، حالة المزامنة، الربط، شبكة المكتب، هوية الشركة،
  عدّادات المستندات، إعدادات النسخ، كلمة مرور الحساب الثابت.
- قواعد تفصيلية في [`supabase/migrations/README.md`](./supabase/migrations/README.md).

| الملف | الموضوع |
| --- | --- |
| `0001_core_entities.sql` | Core entities |
| `0002_devices_batches.sql` | Devices & kit batches |
| `0003_movements_sales.sql` | Stock movements (withdrawals) & sales |
| `0004_views_functions.sql` | Dashboard views & business-logic functions |
| `0005_rls.sql` | Row Level Security |
| `0006_masters.sql` | Master-data fidelity |
| `0007_banking.sql` | Banking & Bank Reconciliation |
| `0008_banking_logic.sql` | Bank reconciliation logic |
| `0009_banking_rls.sql` | RLS for banking tables (mirrors 0005) |
| `0010_purchasing.sql` | Purchasing (Buying) |
| `0011_item_prices.sql` | Item Price (price lists) |
| `0012_payment_terms.sql` | Payment Terms |
| `0013_master_data.sql` | Reference masters |
| `0014_price_lists.sql` | Price List |
| `0015_serial_numbers.sql` | Serial No |
| `0016_warranty_claims.sql` | Warranty Claim |
| `0017_sales_orders.sql` | Sales Order |
| `0018_segmentation.sql` | Territory & Customer Group |
| `0019_categories.sql` | Asset Category & Supplier Group |
| `0020_leads.sql` | Lead (CRM) |
| `0021_opportunities.sql` | Opportunity (CRM) |
| `0022_quotations.sql` | Quotation |
| `0023_stock_reconciliation.sql` | Stock Reconciliation |
| `0024_currency_exchange.sql` | Currency Exchange |
| `0025_accounts.sql` | Account (Chart of Accounts) |
| `0026_journal_entries.sql` | Journal Entry |
| `0027_delivery_notes.sql` | Cost Center & Delivery Note |
| `0029_material_requests.sql` | Material Request |
| `0030_supplier_quotations.sql` | Supplier Quotation |
| `0031_sales_team.sql` | Warehouse Type, Sales Person, Sales Partner |
| `0032_taxes.sql` | Tax Category & Taxes and Charges Templates |
| `0033_manufacturing.sql` | Bill of Materials + Work Order (kit assembly) |
| `0034_maintenance_visits.sql` | Maintenance Visit (device service records) |
| `0035_stock_entries.sql` | Stock Entry (kit-batch receipt / issue / transfer) |
| `0036_quality_inspections.sql` | Quality Inspection (incoming/outgoing QC) |
| `0037_asset_movements.sql` | Asset Movement (device relocation history) |
| `0038_asset_repairs.sql` | Asset Repair (device breakdown repair) |
| `0039_sales_invoices.sql` | Sales Invoice (accounts receivable to labs) |
| `0040_purchase_orders.sql` | Purchase Order (procurement before invoicing) |
| `0041_product_bundles.sql` | Product Bundle (a kit sold as a set of items) |
| `0042_installation_notes.sql` | Installation Note (device installation at a lab) |
| `0043_maintenance_schedules.sql` | Maintenance Schedule (recurring PM plan for a device) |
| `0044_invoice_payments.sql` | Sales Invoice payment ledger |
| `0045_support_issues.sql` | Support Issue (device support tickets) |
| `0046_contracts.sql` | Service Contract / AMC |
| `0047_rfqs.sql` | Request for Quotation (multi-supplier) |
| `0048_appointments.sql` | Appointment (install / service visit scheduling) |
| `0049_maintenance_teams.sql` | Maintenance Team + Task |
| `0050_credit_limits.sql` | Lab credit limit |
| `0051_pricing_rules.sql` | Pricing Rule (lab / quantity discounts) |
| `0052_masters.sql` | Lookup masters |
| `0053_stock_balance.sql` | Stock Balance report |
| `0054_purchase_receipts.sql` | Purchase Receipt (goods receipt) |
| `0055_payment_requests.sql` | Payment Request |
| `0056_blanket_orders.sql` | Blanket Order |
| `0057_pick_lists.sql` | Pick List |
| `0058_delivery_trips.sql` | Delivery Trip |
| `0059_auth.sql` | Application authentication |
| `0060_reports.sql` | Reporting views |
| `0061_global_search.sql` | Global record search |
| `0062_attachments.sql` | File attachments |
| `0063_iqd_currency.sql` | Iraqi Dinar (IQD) + daily USD rate |
| `0064_amc_billing.sql` | Recurring AMC billing (ERPNext "Auto Repeat" / Subscription) |
| `0065_audit_trail.sql` | Immutable audit trail (ported idea from Tryton) |
| `0066_reorder_rules.sql` | Reordering rules (ported idea from Odoo) |
| `0067_maintenance_forecast.sql` | Predictive maintenance forecast |
| `0068_landed_costs.sql` | Landed cost vouchers (ported idea from Metasfresh) |
| `0069_warranty_billing.sql` | Warranty billing party (ported idea from Tryton) |
| `0070_customer_portal.sql` | Customer portal (ported idea from Odoo) |
| `0071_sales_order_serial.sql` | Serial number on sales-order lines |
| `0072_feature_settings.sql` | Feature settings & per-account access |
| `0073_pos_idempotency.sql` | Idempotent POS checkout (offline-safe sales) |
| `0074_monitoring.sql` | Monitoring (errors, connectivity & sync health) |
| `0075_audit_orders.sql` | Audit sales & purchase orders |
| `0076_sale_stock_deduction.sql` | Deduct stock on sale + prevent overselling |
| `0077_auto_gl_posting.sql` | Automatic GL (double-entry) posting from sales & purchases |
| `0078_sales_order_idempotent.sql` | Idempotent sales-order creation (offline-safe) |
| `0079_audit_financial_docs.sql` | Close the audit-trail gaps on financial documents |
| `0080_sales_returns.sql` | Sales Returns (credit notes) |
| `0081_return_batch_no_fix.sql` | Fix duplicate batch_no when a return repeats a product |
| `0082_return_not_more_than_sold.sql` | A return can never exceed what was sold |
| `0083_login_throttle.sql` | Persistent login throttle |
| `0084_demo_user.sql` | Demo login account |
| `0085_security_hardening.sql` | Security hardening |
| `0086_pgcrypto_search_path.sql` | Restore pgcrypto reach for the auth helpers |
| `0087_arabic_master_data.sql` | Arabic master data |
| `0088_fk_indexes.sql` | Cover every foreign key with an index |
| `0089_change_log.sql` | Change log for offline-first sync |
| `0090_arabic_master_data_2.sql` | Arabic master data, second pass |
| `0091_arabic_generated_text.sql` | Arabic for text the database itself writes |
| `0092_prune_change_log.sql` | Keep one month of change log |
| `0093_peer_setting.sql` | Where the hosted database is configured |
| `0094_sync_rejects.sql` | Changes the far end refused |
| `0095_branding.sql` | Company identity, and document numbering |
| `0096_shortcuts_documents.sql` | Sales requests and transport authorisations |
| `0097_search_shortcuts.sql` | Find sales requests and authorisations by number |
| `0098_doc_prefix_fallback.sql` | Document numbers cannot collide, configured or not |
| `0099_bank_action_log.sql` | A real reconciliation action log |
| `0100_partial_allocation.sql` | Partial allocation between payments and bank lines |
| `0101_undo_a_match.sql` | Undoing a match |
| `0102_arabic_errors.sql` | Arabic for every error the database raises |
| `0103_end_sessions.sql` | Ending a user's sessions |
| `0104_close_hosted_data_api.sql` | Close the hosted database's public data API |
| `0105_sync_links.sql` | Linking computers to each other |
| `0106_sync_mirrors.sql` | A synced change is a copy, not a new event |
| `0107_drop_default_accounts.sql` | No accounts with passwords everyone knows |
| `0108_prune_standalone.sql` | A computer on its own still forgets old changes |
| `0109_builtin_password.sql` | The built-in account's password can be changed |
| `0110_auto_backup.sql` | Automatic backups |
| `0111_sync_renames.sql` | Two computers, one code |

## 8) الأمان

- البرنامج يستمع على هذا الحاسوب فقط (127.0.0.1)، إلا بخيار المثبِّت `-Lan` المقصود.
- فحص الصلاحية في طبقة البيانات لكل استعلام (`src/lib/db/rest.ts`)، لأن أي إجراء يمكن استدعاؤه من أي صفحة.
- الجلسات موقّعة بمفتاح خاص بكل تثبيت (`AUTH_SECRET` في `.env.local`)، وتنتهي فوراً بتغيير كلمة المرور أو التعطيل.
- لا حسابات بكلمات مرور معروفة في القاعدة (0107)؛ كلمة مرور الحساب الثابت تُغيَّر من الإعدادات.
- واجهة Supabase العامة مغلقة (0104)؛ البرنامج يتصل بالقاعدة المستضافة مباشرةً فقط.
- رموز المزامنة تفتح كل السجلّات: تُعرض للمسؤول فقط وعند الطلب، ويمكن تغييرها لقطع كل من يحمل القديم.

## 9) الاختبارات

- **وحدات** (`tests/*.test.mjs`): تشغّل Postgres في الذاكرة مع الـ migrations الحقيقية، وتختبر منطق العمل والمزامنة
  والنسخ. أدوات مشتركة في `tests/helpers.mjs` (منها `importTs` لتشغيل ملفّات `src` المستقلّة كما هي).
- **متصفّح** (`tests/browser/*.mjs`): على خادم حقيقي بالمنفذ 3399. منها `crawl.mjs` (يزور كل الصفحات ويبحث عن
  نصّ إنجليزي أو أرقام هندية أو أخطاء)، و`e2e-lan-sync.mjs` (ثلاثة خوادم تُربط ببعضها عبر الواجهة).
- CI على GitHub يشغّل الفحص والبناء واختبارات الوحدات عند كل دفع.

## 10) الوثائق الأخرى

| الملف | المحتوى |
| --- | --- |
| [`docs/INSTALL.md`](./docs/INSTALL.md) | تثبيت ويندوز ولينكس، التحديث، النقل، ربط الحواسيب |
| [`docs/HOSTED-SETUP.md`](./docs/HOSTED-SETUP.md) | القاعدة المستضافة (Supabase) والنسخة التجريبية على Vercel |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | متغيّرات البيئة والنشر |
| [`docs/ERPNEXT-PARITY.md`](./docs/ERPNEXT-PARITY.md) | مقابلة خواص ERPNext بما في البرنامج |
| [`supabase/migrations/README.md`](./supabase/migrations/README.md) | قواعد كتابة الـ migrations |
| [`tests/browser/README.md`](./tests/browser/README.md) | اختبارات المتصفّح |
| التعليمات داخل البرنامج | الإعداد ← تعليمات: الشرح للمستخدم النهائي |

## 11) قواعد لا تُكسر

1. الواجهة عربية فقط، وكل نص عبر `t()`، والأرقام 1234. لا تُحذف الإنجليزية من القاموس.
2. البيانات حقيقية فقط: قاعدة جديدة فارغة، والتجريبية بطلب صريح.
3. لا يُحذف شيء من بيانات المستخدم قبل التأكّد من البديل (الاستعادة تفحص الملف أولاً وتأخذ نسخة أمان).
4. البرنامج مغلق أمام الشبكة؛ لا يُفتح عبرها إلا باب المزامنة المشفّر.
5. كل migration تُختبر بـ `npm test`، وكل تغيير في الواجهة باختبارات المتصفّح.
