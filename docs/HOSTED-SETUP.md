# ربط Spir-Margin بقاعدة Supabase المستضافة + حساب الدخول التجريبي

هذا الدليل يشرح خطوات تشغيل Spir-Margin على البنية الحية، بربط الثوابت الثلاثة:

- **GitHub:** `inzohussein-blip/Spir-Margin`
- **Supabase:** مشروع `yzvrcshwalgzkniunray` (`https://yzvrcshwalgzkniunray.supabase.co`)
- **Vercel:** `spir-margin` (`inzohussein-blips-projects`)

> ملاحظة: هذا مشروع منفصل تمامًا عن `Spir_Medical`. لا تُطبّق أيًّا من هذه الخطوات
> على قاعدة `Spir_Medical`.

---

## 1) كيف يتصل التطبيق بالقاعدة (مهم)

التطبيق يختار الخلفية تلقائيًا حسب متغيّر البيئة `DATABASE_URL`:

- **غير مضبوط** → Postgres مدمج (PGlite) — للتطوير المحلي فقط، لا يصلح على Vercel
  لأن التخزين مؤقت بين الطلبات.
- **مضبوط** → Postgres المستضاف (Supabase) عبر `node-postgres`.

وعند الإقلاع على القاعدة المستضافة، **يطبّق التطبيق الـ migrations الناقصة تلقائيًا**
(بسجلّ `_spir_migrations`)، بما فيها `0084_demo_user.sql`. أي أن مجرّد **إعادة نشر**
تطبيق Vercel بعد ضبط `DATABASE_URL` كافٍ لتهيئة القاعدة كاملةً — دون تشغيل SQL يدويًا.
(للتعطيل: `SPIR_SKIP_MIGRATIONS=1`.)

---

## 2) متغيّرات البيئة المطلوبة في Vercel

من لوحة Vercel → مشروع `spir-margin` → **Settings → Environment Variables**، أضِف
للبيئة **Production** (وPreview إن أردت):

| المتغيّر | القيمة | إلزامي |
| --- | --- | --- |
| `DATABASE_URL` | سلسلة اتصال Supabase (انظر أدناه) | ✅ |
| `AUTH_SECRET` | قيمة عشوائية طويلة لتوقيع الجلسات — `openssl rand -base64 48` | ✅ (يرفض التطبيق الإقلاع بدونها على استضافة) |
| `PGPOOL_MAX` | حجم بركة الاتصال، مثال `5` | اختياري |

### الحصول على `DATABASE_URL`

من لوحة Supabase → مشروع `yzvrcshwalgzkniunray` → زر **Connect** → تبويب
**Connection string** → **Transaction pooler** (الموصى به لبيئة Vercel serverless):

```
postgresql://postgres.yzvrcshwalgzkniunray:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres
```

- استبدل `[YOUR-PASSWORD]` بكلمة مرور قاعدة البيانات (Supabase → Settings → Database).
- استبدل `<region>` بمنطقة مشروعك كما تظهر في نفس الشاشة.
- أبقِ TLS مفعّلًا (لا تضبط `PGSSL=disable` مع Supabase).

بعد الضبط: **Deployments → أعد نشر آخر نشرة** (Redeploy). سيطبّق التطبيق كل الـ
migrations تلقائيًا عند أول طلب.

---

## 3) حسابات الدخول

الحساب المدمج في `src/lib/auth/demo-credentials.ts` يعمل دائماً:

| الحساب | البريد | كلمة المرور | الدور |
| --- | --- | --- | --- |
| **المدمج** | `admin@spir.local` | `123` | admin |

يُفحص هذا الحساب في الشيفرة قبل أي اتصال بقاعدة البيانات، فيعمل على حاسوب
جديد بلا قاعدة مستضافة وبلا إنترنت. لتغييره عدّل الملف أعلاه وأعد البناء —
لا يوجد له صف في قاعدة البيانات.

إضافةً إليه تعمل الحسابات المخزّنة في جدول `app_users` حين تتوفّر قاعدة
بيانات. الحساب التجريبي منها يُنشأ عبر migration `0084_demo_user.sql`
(`demo@spir.local` / `demo1234`). **غيّر كلمات المرور هذه فور أول دخول**
(الإعدادات → المستخدمون)، أو عطّل الحساب التجريبي في الإنتاج:

```sql
update app_users set is_active = false where email = 'demo@spir.local';
```

### تطبيق/إعادة ضبط الحسابات يدويًا (اختياري)

إن أردت إنشاء الحساب دون إعادة نشر، شغّل في **Supabase → SQL Editor**:

```sql
-- إنشاء الحساب التجريبي (لا يُكرّر إن كان موجودًا)
select fn_create_user('demo@spir.local', 'demo1234', 'Demo User', 'admin');
```

لإعادة ضبط كلمة مرور حساب موجود (مثلاً إن نُسي admin):

```sql
select fn_set_password(id, 'كلمة-مرور-جديدة') from app_users where email = 'admin@spir.local';
```

للتحقق من صحّة الدخول دون واجهة:

```sql
select * from fn_verify_login('demo@spir.local', 'demo1234');  -- صف واحد = ناجح
```

> يوجد أيضًا سير عمل GitHub يدوي **Verify admin login** (Actions → Run workflow)
> يفحص الدخول ضدّ القاعدة الحقيقية عبر سرّ `DATABASE_URL`، ويعيد ضبط كلمة المرور
> اختياريًا من سرّ `ADMIN_NEW_PASSWORD`.

---

## 4) تطبيق المخطط يدويًا (بديل عن الإطلاق التلقائي)

إن فضّلت تهيئة القاعدة يدويًا بدل الاعتماد على الإطلاق التلقائي:

```bash
# ملف واحد مجمّع (كل الـ migrations، المخطّط فقط بلا بيانات تجريبية)
psql "$DATABASE_URL" -f supabase/schema.sql

# أو الملفات المرقّمة بالترتيب
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done

# اختياري — بيانات تجريبية، لقاعدة تجريبية فقط لا للإنتاج
psql "$DATABASE_URL" -f supabase/seed.sql
```

ثم اضبط `SPIR_SKIP_MIGRATIONS=1` في Vercel لتخطّي الإطلاق التلقائي.

---

## 5) قائمة تحقّق سريعة

- [ ] `DATABASE_URL` مضبوط في Vercel ويشير إلى `yzvrcshwalgzkniunray` (Transaction pooler).
- [ ] `AUTH_SECRET` مضبوط (قيمة عشوائية طويلة).
- [ ] إعادة نشر تطبيق Vercel → نجاح البناء والإقلاع.
- [ ] الدخول بـ `admin@spir.local` / `123` يعمل.
- [ ] تغيير/تعطيل الحسابات التجريبية في الإنتاج.
