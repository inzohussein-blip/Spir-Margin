# نسخة ويندوز — مؤرشفة ومغلقة

أُغلقت نسخة ويندوز (البرنامج المثبَّت على الحاسوب) في هذا المجلد بطلب المالك، ليُعمل على
نسخة الويب وحدها. كل ما فيه محفوظ كما كان عند الإغلاق، بتاريخه في git، لاستخدامه لاحقاً.

**المجلد مغلق:**
- لا يدخل في البناء (`tsconfig.json` يستثني `windows-archive`) ولا في Vercel.
- لا تُشغَّل اختباراته (`npm test` يقرأ `tests/*.test.mjs` فقط، ومشغّل المتصفح `tests/browser/*.mjs` فقط).
- لا تصدر إصدارات: سير عمل الإصدارات منقول إلى `github-workflows/`، وGitHub لا يقرأ إلا `.github/workflows/`.
  الحواسيب المثبّتة سابقاً تبقى على آخر إصدار استلمته، ولا يصلها شيء جديد.

## ما فيه، ومن أين جاء

| هنا | مكانه الأصلي | ما هو |
| --- | --- | --- |
| `install-windows.cmd` | `/install-windows.cmd` | المثبّت (نقرة مزدوجة) — يستدعي `scripts/windows/install.ps1` |
| `update-windows.cmd` | `/update-windows.cmd` | التحديث إلى أحدث إصدار — يستدعي `scripts/windows/update.ps1` |
| `scripts/windows/` | `/scripts/windows/` | `install.ps1` (PowerShell 5.1، UTF-8 مع BOM، CRLF)، `update.ps1` (مجلد مرحلي، بناء، تبديل، فحص، تراجع)، `run-server.cmd`، `run-hidden.vbs`، `open-app.vbs` (UTF-16) |
| `scripts/service/` | `/scripts/service/` | تثبيت الخدمة على لينكس (systemd) — للنسخة المثبّتة كذلك |
| `github-workflows/release.yml` | `/.github/workflows/release.yml` | بعد نجاح CI على `main`: إصدار مرقّم `build-N` بملف `spir-margin.zip` فيه `version.json` |
| `docs/INSTALL.md`، `docs/WINDOWS-TRIAL.md` | `/docs/` | شرح التثبيت، وقائمة التجربة على حواسيب حقيقية |
| `src/lib/update/` | `/src/lib/update/` | التحديث داخل البرنامج: `release.ts` (صرف، يقرأ الإصدارات)، `updates.ts` (فحص كل 6 ساعات، `startUpdate`، `updateTick`) |
| `src/app/actions/updates.ts` | نفسه | أفعال لوحة التحديثات |
| `src/app/api/update/status/route.ts` | نفسه | حالة التحديث الجاري |
| `src/components/settings/UpdatesPanel.tsx` | نفسه | لوحة «التحديثات» في الإعدادات |
| `src/components/help/install-topic.tsx` | مدخل `install` في `src/components/help/topics.tsx` | تبويب «التثبيت على ويندوز» في التعليمات |
| `tests/windows-installer.test.mjs`، `tests/windows-updater.test.mjs`، `tests/update-release.test.mjs` | `/tests/` | اختبارات المثبّت والمحدِّث والإصدارات |
| `tests/browser/e2e-updates.mjs` | `/tests/browser/` | اختبار لوحة التحديثات في المتصفح |

## ما بقي في البرنامج (عن قصد)

- الصفحات التي يعرضها الخادم (`src/app/*` عدا `/app`) بقيت مكانها: يشترك فيها موقع الويب (خادم الرموز
  `/licenses`، و`/api/*`، وصفحة الترحيب) والبرنامج المثبّت نفسه، وهي المرجع الذي تحاكيه صفحات تطبيق الويب.
- مزامنة شبكة المكتب (`src/lib/sync/lan.ts`) والوصول من الأجهزة الأخرى (`src/lib/remote/`) والنسخ الاحتياطي
  التلقائي إلى مجلد: تعمل فقط حين يشتغل البرنامج على حاسوب، ولا تعمل على Vercel.
- `src/lib/version.ts`: يقرأ `version.json` إن وُجد (نسخة مثبّتة) ليرسل رقم الإصدار مع فحص الرمز.
- الـ migration `0112_auto_update.sql` وجدول إعدادات التحديث: لا تُحذف migration أبداً.
- `.gitattributes` (CRLF لملفات `.cmd`/`.ps1`، و`.vbs` ثنائية) يبقى ليحفظ ملفات هذا المجلد سليمة.

## إعادة فتحها

أعد كل ملف إلى مكانه الأصلي في الجدول أعلاه (`git mv`)، ثم:
1. في `src/app/layout.tsx`: إشعار «إصدار جديد متوفر» (`updateAvailable` من `@/lib/update/updates`).
2. في `src/app/settings/page.tsx`: قسم «التحديثات» (`UpdatesPanel` + `updatesView`).
3. في `src/instrumentation-node.ts`: `updateTick()` في الدورة الدورية.
4. في `src/components/help/topics.tsx`: مدخل `install` قبل `settings`، ومدخل «التحديثات» في تبويب الإعدادات.
5. `tests/browser/routes.txt`: `/help?tab=install`، و`tests/browser/e2e-help.mjs`: التبويب `install`.
6. `src/lib/license/device.ts` و`src/app/api/license/admin/route.ts` يستوردان `currentBuild` من `@/lib/version` — يعملان كما هما.
7. `npx tsc --noEmit && npm run lint && npm test`.

الحال كما كانت قبل الإغلاق موجودة في git عند الـ commit `48fb445` (آخر ما دُمج قبل الإغلاق).
