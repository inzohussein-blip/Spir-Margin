import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutGridIcon, RocketIcon, MonitorDownIcon, SettingsIcon, WifiOffIcon,
  HardDriveIcon, UsersIcon, LifeBuoyIcon, BuildingIcon, CloudIcon, ToggleLeftIcon,
  ShieldIcon, RefreshCwIcon, PrinterIcon, KeyRoundIcon, SearchIcon, type LucideIcon,
} from "lucide-react";
import { navGroups } from "@/lib/nav";
import { t, type Locale } from "@/lib/i18n";
import { HelpSection, Steps, Bullets, Note, Code, Key, UiPath, Pairs } from "./parts";

/**
 * The Instructions (تعليمات) content.
 *
 * Written in Arabic, the app's working language — long-form guidance is not
 * worth maintaining twice while the English UI is switched off. What the text
 * points AT is not hard-coded, though: every on-screen name (a menu, a page, a
 * Settings panel) is looked up through the same dictionary the screens use, so
 * «الإعداد ← الإعدادات ← النسخ الاحتياطي» here always reads exactly as it does
 * there. And the features tab is built from the navigation itself, so a new
 * page shows up in it on its own.
 */

export interface HelpTopic {
  id: string;
  title: string;
  icon: LucideIcon;
  render: (locale: Locale) => ReactNode;
}

/** One line on what each menu group is for, keyed by its navigation label. */
const GROUP_PURPOSE: Record<string, string> = {
  Home: "ملخّص اليوم في صفحة واحدة: المبيعات، والفواتير المستحقّة، والصيانة القادمة، والكِتّات القريبة من الانتهاء، والتخويلات التي تنتهي قريباً.",
  Shortcuts: "المستندان الأكثر استخداماً: طلب البيع (وصل يُسلَّم للزبون) وتخويل نقل الأجهزة والمستلزمات الطبية بين المحافظات. كلاهما يُطبع بشعار الشركة واسمها.",
  CRM: "متابعة الزبائن المحتملين والفرص البيعية والمواعيد وعقود الصيانة.",
  Selling: "نقطة البيع، والمختبرات (الزبائن)، وعروض الأسعار، وأوامر البيع وفواتيره، والمرتجعات، والاتفاقيات الإطارية، وحدود الائتمان وقواعد التسعير.",
  Buying: "المورّدون، واقتراحات إعادة الطلب، وطلبات عروض الأسعار، وأوامر الشراء واستلامها، والمشتريات وتكاليف الوصول.",
  Stock: "الأصناف والحزم، والكِتّات بدُفعاتها وتواريخ انتهائها، والأرقام التسلسلية، والمخازن وحركاتها، وقوائم الانتقاء ورحلات التوصيل، ورصيد المخزون والأسعار.",
  Manufacturing: "قوائم المواد، وأوامر العمل، وفحوص الجودة.",
  Assets: "الأجهزة المركّبة لدى المختبرات: نقلها بين المواقع، وتركيبها، وإصلاحها.",
  Maintenance: "لوحة الخدمة الميدانية، وتوقّعات الصيانة، والزيارات، وجداول الصيانة الوقائية، والفرق.",
  Support: "بلاغات الزبائن، ومتابعة الضمان.",
  Accounting: "طلبات الدفع، وفوترة عقود الصيانة، والبنوك والتسوية المصرفية، ودليل الحسابات، والعملات وسعر الصرف.",
  Reports: "التقارير: أعمار الذمم، والربحية، والمبيعات حسب المختبر والصنف، والمشتريات، ورصيد المخزون.",
  Tools: "آلة حاسبة، وحاسبة الربح، ومحوّل العملات بين الدولار والدينار.",
  Monitoring: "للمسؤول والمدير: الأخطاء التي وقعت، وسجلّ كل تغيير وحذف، وحالة المزامنة.",
  Setup: "البيانات الأساسية، والمستخدمون، والإعدادات، وسجلّ التدقيق، وهذه التعليمات.",
};

export const HELP_TOPICS: HelpTopic[] = [
  // ------------------------------------------------------------------ features
  {
    id: "features",
    title: "الخواص",
    icon: LayoutGridIcon,
    render: (locale) => (
      <div className="space-y-4">
        <HelpSection title="ما هو Spir-Margin" icon={LayoutGridIcon}>
          <p>
            نظام لإدارة شركة أجهزة ومستلزمات طبية ومختبرات: البيع والشراء، والمخزون وتواريخ الانتهاء، والأجهزة
            المركّبة وصيانتها، والحسابات والبنوك، والتقارير — بالعربية كاملاً.
          </p>
          <Bullets>
            <li><strong>يعمل على هذا الحاسوب</strong>: البرنامج وقاعدة البيانات عليه، فلا يحتاج إنترنت للعمل اليومي.</li>
            <li><strong>المزامنة اختيارية</strong>: إن ضُبطت قاعدة مستضافة تُرسَل التغييرات إليها تلقائياً حين يتوفّر الإنترنت.</li>
            <li><strong>مستندات مطبوعة بهوية الشركة</strong>: الشعار والاسم والعنوان والعلامة المائية على كل ورقة.</li>
            <li><strong>سجلّ لكل تغيير</strong>: من غيّر ماذا ومتى، ولا يمكن تعديل هذا السجلّ أو حذفه.</li>
          </Bullets>
          <p className="flex flex-wrap items-center gap-1.5">
            <SearchIcon size={14} className="text-ink-gray-5" />
            للانتقال السريع إلى أي صفحة أو سجلّ اضغط <Key>Ctrl</Key>+<Key>K</Key> واكتب ما تبحث عنه — رقم مستند، أو اسم
            مختبر، أو اسم صفحة.
          </p>
        </HelpSection>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {navGroups.map((g) => (
            <HelpSection key={g.label} title={t(locale, g.label)}>
              {GROUP_PURPOSE[g.label] ? <p>{GROUP_PURPOSE[g.label]}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className="inline-flex items-center gap-1 rounded-full border border-outline-gray-2 px-2.5 py-1 text-xs text-ink-gray-7 hover:border-brand hover:text-brand"
                  >
                    <item.icon size={12} />
                    {t(locale, item.label)}
                  </Link>
                ))}
              </div>
            </HelpSection>
          ))}
        </div>
      </div>
    ),
  },

  // ------------------------------------------------------------------ getting started
  {
    id: "start",
    title: "البدء السريع",
    icon: RocketIcon,
    render: (locale) => (
      <div className="space-y-4">
        <HelpSection title="أول يوم عمل" icon={RocketIcon}>
          <p>قاعدة البيانات تبدأ فارغة، جاهزة لبيانات الشركة. بهذا الترتيب:</p>
          <Steps>
            <li>
              <strong>هوية الشركة</strong>: الاسم والشعار والعنوان وأرقام التواصل — تظهر على كل مستند مطبوع.{" "}
              <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Company identity")]} href="/settings" />
            </li>
            <li>
              <strong>حساب لكل موظّف</strong> بدل الحساب المشترك، حتى يُعرَف من سجّل كل عملية.{" "}
              <UiPath parts={[t(locale, "Setup"), t(locale, "Users")]} href="/users" />
            </li>
            <li>
              <strong>الزبائن</strong>: أضف المختبرات التي تتعامل معها.{" "}
              <UiPath parts={[t(locale, "Selling"), t(locale, "Labs")]} href="/labs" />
            </li>
            <li>
              <strong>الأصناف</strong> بأسعار الشراء والبيع، ونوع كل صنف (جهاز، كِت، قطعة غيار).{" "}
              <UiPath parts={[t(locale, "Stock"), t(locale, "Products")]} href="/products" />
            </li>
            <li>
              <strong>استلام المخزون</strong>: الكِتّات تُباع من دُفعات مستلَمة، فسجّل الدفعة بكمّيتها وتاريخ انتهائها قبل
              أول بيع.{" "}
              <UiPath parts={[t(locale, "Stock"), t(locale, "Kits")]} href="/kits" />
            </li>
            <li>
              <strong>أول بيع</strong> من نقطة البيع: اختر المختبر، ثم الأصناف، ثم «إتمام البيع».{" "}
              <UiPath parts={[t(locale, "Selling"), t(locale, "Point of Sale")]} href="/pos" />
            </li>
          </Steps>
          <Note>
            البرنامج يرفض بيع ما ليس في المخزون، ويقول لك الكمية المتوفّرة. إن ظهرت «الكمية غير كافية» فسجّل استلام
            دفعة أولاً.
          </Note>
        </HelpSection>

        <HelpSection title="المستندات الأكثر استخداماً" icon={PrinterIcon}>
          <Pairs
            head={["المستند", "متى يُستخدم"]}
            rows={[
              [<Link key="a" href="/sale-requests/new" className="text-brand hover:underline">{t(locale, "Sales requests")}</Link>,
                "طلب الزبون قبل الفوترة، ولو بالهاتف. يُطبع وصلاً بشعار الشركة يُسلَّم للزبون، ويبقى قابلاً للتعديل ما دام مسودّة."],
              [<Link key="b" href="/authorizations/new" className="text-brand hover:underline">{t(locale, "Transport authorisations")}</Link>,
                "كتاب رسمي يخوّل شخصاً نقل أجهزة أو مستلزمات من محافظة إلى أخرى حتى تاريخ محدّد. يُطبع ليُبرَز عند نقاط التفتيش، ويُعاد إصداره بنقرة للرحلة التالية."],
              [<Link key="c" href="/sales-invoices" className="text-brand hover:underline">{t(locale, "Sales Invoices")}</Link>,
                "الفاتورة الرسمية ومتابعة المدفوع والمتبقّي منها."],
            ]}
          />
          <p>
            للطباعة افتح المستند واضغط زرّ الطباعة فيه، أو <Key>Ctrl</Key>+<Key>P</Key>، واختر ورق A4.
          </p>
        </HelpSection>
      </div>
    ),
  },

  // ------------------------------------------------------------------ Windows install
  {
    id: "install",
    title: "التثبيت على ويندوز",
    icon: MonitorDownIcon,
    render: () => (
      <div className="space-y-4">
        <HelpSection title="قبل البدء" icon={MonitorDownIcon}>
          <Bullets>
            <li>
              ثبّت <strong>Node.js</strong> بالنسخة LTS (18.18 أو أحدث) من الموقع <Code>nodejs.org</Code>، واترك خيارات
              التثبيت الافتراضية كما هي.
            </li>
            <li>
              انسخ مجلّد البرنامج إلى مكان دائم، مثل <Code>C:\Spir-Margin</Code> — لا تشغّله من مجلّد التنزيلات ولا من
              فلاشة.
            </li>
            <li>يلزم الإنترنت أثناء التثبيت فقط، لتنزيل مكوّنات البرنامج.</li>
          </Bullets>
        </HelpSection>

        <HelpSection title="التثبيت">
          <Steps>
            <li>افتح مجلّد البرنامج وانقر نقراً مزدوجاً على <Code>install-windows.cmd</Code>.</li>
            <li>انتظر حتى ينتهي (بضع دقائق في المرّة الأولى). لا تحتاج صلاحيّات المسؤول.</li>
            <li>تظهر رسالة «تمّ تثبيت Spir-Margin»، ويُفتح البرنامج في نافذته.</li>
            <li>
              <strong>للتأكّد</strong>: أعد تشغيل الحاسوب، ثم افتح أيقونة Spir-Margin على سطح المكتب. إن فُتح البرنامج
              فالتثبيت سليم.
            </li>
          </Steps>
          <Pairs
            head={["ما يضيفه المثبِّت", "ماذا يفعل"]}
            rows={[
              ["أيقونة على سطح المكتب وفي قائمة ابدأ", "تشغّل البرنامج إن كان متوقّفاً، وتنتظر جاهزيّته، ثم تفتحه في نافذة مستقلّة."],
              ["تشغيل تلقائي عند الدخول إلى ويندوز", "يعمل في الخلفية بلا نوافذ، ويعيد تشغيل نفسه إن توقّف."],
              ["قاعدة بيانات فارغة", "جاهزة لبيانات الشركة. البيانات الموجودة سابقاً على الحاسوب — إن وُجدت — تبقى كما هي."],
            ]}
          />
        </HelpSection>

        <HelpSection title="خيارات أخرى">
          <p>تُكتب بعد اسم الملف في موجّه الأوامر داخل مجلّد البرنامج:</p>
          <Pairs
            rows={[
              [<Code key="u">install-windows.cmd -Update</Code>, "بعد نسخ نسخة جديدة فوق المجلّد: يوقف البرنامج، ويعيد بناءه، ثم يشغّله. خذ نسخة احتياطية قبلها."],
              [<Code key="x">install-windows.cmd -Uninstall</Code>, "يزيل الأيقونات والتشغيل التلقائي ويوقف البرنامج. لا يحذف البيانات."],
              [<Code key="d">install-windows.cmd -Demo</Code>, "قاعدة جديدة ببيانات تجريبية للتدريب — على حاسوب تدريب، لا على حاسوب العمل."],
              [<Code key="l">install-windows.cmd -Lan</Code>, "يفتح البرنامج لأجهزة شبكة المكتب. استخدمه على شبكة موثوقة فقط (انظر «المستخدمون والأمان»)."],
            ]}
          />
          <Note>
            على لينكس: <Code>sudo ./scripts/service/install-linux.sh</Code> — يسجّله خدمةً تبدأ مع الحاسوب ويضيفه إلى قائمة
            التطبيقات.
          </Note>
        </HelpSection>
      </div>
    ),
  },

  // ------------------------------------------------------------------ settings
  {
    id: "settings",
    title: "الإعدادات",
    icon: SettingsIcon,
    render: (locale) => (
      <div className="space-y-4">
        <Note>
          صفحة <UiPath parts={[t(locale, "Setup"), t(locale, "Settings")]} href="/settings" /> للمسؤول وحده. هذه أقسامها
          بالترتيب الذي تظهر به:
        </Note>

        <HelpSection title={t(locale, "Company identity")} icon={BuildingIcon}>
          <p>
            اسم الشركة وشعارها وشعارها النصّي، والعنوان والمدينة والهاتف والبريد والموقع والرقم الضريبي، وسطر أسفل
            الصفحة، وعلامة مائية اختيارية. تظهر كلّها على كل مستند مطبوع.
          </p>
          <p>
            <strong>{t(locale, "Document prefix")}</strong>: حروف تسبق رقم كل مستند (مثل <Code>BGD</Code>). إن كان للشركة
            أكثر من حاسوب فأعطِ كل حاسوب بادئته — أو اتركها فارغة، فيضع كل حاسوب علامة خاصّة به تلقائياً، فلا يتكرّر
            رقم بين حاسوبين في الحالتين.
          </p>
          <Note>هوية الشركة محفوظة على هذا الحاسوب وحده ولا تُزامَن، فلكل فرع أن يطبع بعنوانه.</Note>
        </HelpSection>

        <HelpSection title={t(locale, "Install as an app")} icon={MonitorDownIcon}>
          <p>
            يمنح البرنامج نافذة وأيقونة من المتصفّح (Edge أو Chrome). المثبِّت يضيف أيقونة أصلاً، فهذا اختياري. التطبيق
            المثبَّت يعمل من البرنامج نفسه على هذا الحاسوب، فلا فرق في البيانات.
          </p>
        </HelpSection>

        <HelpSection title={t(locale, "Hosted database")} icon={CloudIcon}>
          <p>
            اختياري. عنوان قاعدة بيانات على الإنترنت تُرسَل إليها التغييرات وتُستقبَل منها، لتتشارك عدّة حواسيب البيانات
            نفسها ولتكون هناك نسخة خارج هذا الحاسوب. يُختبر الاتصال قبل الحفظ، ولا يُحفظ عنوان لا يعمل.
          </p>
          <p>بلا قاعدة مستضافة يعمل البرنامج كاملاً، وتبقى البيانات على هذا الحاسوب وحده.</p>
        </HelpSection>

        <HelpSection title={t(locale, "Backup and restore")} icon={HardDriveIcon}>
          <p>تنزيل نسخة كاملة من قاعدة البيانات، واستعادة نسخة سابقة. التفاصيل في تبويب «النسخ الاحتياطي».</p>
        </HelpSection>

        <HelpSection title={t(locale, "Non-essential features")} icon={ToggleLeftIcon}>
          <p>لكل قسم لا تحتاجه الشركة ثلاث حالات:</p>
          <Pairs
            rows={[
              ["مُفعَّل", "يعمل كالمعتاد."],
              [t(locale, "Disable"), "يبقى ظاهراً في القائمة، لكن فتحه يقول إن المسؤول عطّله."],
              [t(locale, "Hide"), "يختفي من القائمة تماماً."],
            ]}
          />
          <p>الأقسام الأساسية (الرئيسية والإعداد) لا تُعطَّل.</p>
        </HelpSection>

        <HelpSection title={t(locale, "Feature access")} icon={ShieldIcon}>
          <p>
            كل حساب يرى كل الأقسام افتراضياً. هنا تمنع حساباً معيّناً من أقسام بعينها — مثلاً موظّف المبيعات من
            المحاسبة. ومن هنا أيضاً يُحذف حساب نهائياً.
          </p>
        </HelpSection>

        <HelpSection title="صفحات قريبة">
          <Bullets>
            <li><UiPath parts={[t(locale, "Setup"), t(locale, "Masters")]} href="/masters" /> — القوائم المرجعية في نماذج العملاء والمبيعات: أنواع الفرص، ومراحل البيع، وأسباب خسارة الفرص، والشروط والأحكام.</li>
            <li><UiPath parts={[t(locale, "Setup"), t(locale, "Users")]} href="/users" /> — إضافة الحسابات وتعطيلها.</li>
            <li><UiPath parts={[t(locale, "Setup"), t(locale, "Audit Log")]} href="/audit-log" /> — سجلّ ما تغيّر في السجلّات المالية والحسّاسة.</li>
          </Bullets>
        </HelpSection>
      </div>
    ),
  },

  // ------------------------------------------------------------------ offline & sync
  {
    id: "offline",
    title: "العمل دون إنترنت والمزامنة",
    icon: WifiOffIcon,
    render: (locale) => (
      <div className="space-y-4">
        <HelpSection title="بلا إنترنت، يعمل كل شيء" icon={WifiOffIcon}>
          <p>
            البرنامج وقاعدة البيانات على هذا الحاسوب، فانقطاع الإنترنت لا يوقف شيئاً: البيع والشراء والطباعة والتقارير
            تعمل كالمعتاد، وكل عملية تُحفظ مباشرة في قاعدة بيانات الحاسوب.
          </p>
          <p>إن كانت هناك قاعدة مستضافة، تُحفظ التغييرات هنا وتُرسَل إليها تلقائياً حين يعود الإنترنت.</p>
        </HelpSection>

        <HelpSection title="مؤشّرات أعلى الشاشة" icon={RefreshCwIcon}>
          <Pairs
            head={["ما يظهر", "معناه"]}
            rows={[
              [t(locale, "Online") + " / " + t(locale, "Offline"), "هل على الحاسوب إنترنت. للمعلومة فقط — لا يؤثّر في حفظ عملك."],
              [t(locale, "This computer only"), "لا توجد قاعدة مستضافة مضبوطة؛ البيانات كلّها على هذا الحاسوب. خذ نسخاً احتياطية بانتظام."],
              [t(locale, "Synced"), "كل شيء أُرسل إلى القاعدة المستضافة."],
              [t(locale, "Changes are waiting to be sent"), "تغييرات محفوظة هنا تنتظر الإنترنت. تُرسَل تلقائياً كل دقيقتين، أو بزرّ «" + t(locale, "Sync now") + "»."],
              [t(locale, "Sync failed"), "لم تنجح المحاولة الأخيرة. البيانات محفوظة هنا ولم يضع شيء؛ السبب في صفحة صحّة المزامنة."],
            ]}
          />
          <p>
            للتفاصيل: <UiPath parts={[t(locale, "Monitoring"), t(locale, "Sync Health")]} href="/monitoring/sync" /> (للمسؤول
            والمدير).
          </p>
        </HelpSection>

        <HelpSection title="إن لم يستجب البرنامج" icon={LifeBuoyIcon}>
          <p>
            إن فُتحت النافذة والبرنامج لم يبدأ بعد — عادةً في الدقيقة الأولى بعد تشغيل الحاسوب — تظهر صفحة «البرنامج لا
            يستجيب بعد». لا حاجة لفعل شيء: تحاول الاتصال كل ثلاث ثوانٍ وتفتح البرنامج حين يجهز.
          </p>
          <p>
            وإن ضغطت «إتمام البيع» في تلك اللحظة يُحفظ البيع مؤقتاً على الشاشة ويُرسَل وحده حين يجيب البرنامج — لا تكرّره.
          </p>
        </HelpSection>
      </div>
    ),
  },

  // ------------------------------------------------------------------ backup
  {
    id: "backup",
    title: "النسخ الاحتياطي",
    icon: HardDriveIcon,
    render: (locale) => (
      <div className="space-y-4">
        <Note kind="warn">
          بلا قاعدة مستضافة، البيانات كلّها في المجلّد <Code>.pglite-data</Code> داخل مجلّد البرنامج — وهو النسخة الوحيدة.
          عطل في القرص يعني ضياعها إن لم تكن هناك نسخة احتياطية.
        </Note>

        <HelpSection title="أخذ نسخة احتياطية" icon={HardDriveIcon}>
          <Steps>
            <li>
              افتح <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Backup and restore")]} href="/settings" />.
            </li>
            <li>اضغط زرّ التنزيل؛ يُنزَّل ملف باسم يحمل التاريخ والوقت.</li>
            <li><strong>احفظه خارج هذا الحاسوب</strong>: فلاشة، أو قرص خارجي، أو بريد الشركة.</li>
          </Steps>
          <p>متى؟ بعد إعداد البرنامج مباشرة، ثم أسبوعياً على الأقل، وقبل كل تحديث.</p>
        </HelpSection>

        <HelpSection title="الاستعادة">
          <p>من القسم نفسه، اختر ملف نسخة احتياطية واستعده.</p>
          <Note kind="warn">
            الاستعادة <strong>تستبدل</strong> كل ما على هذا الحاسوب بمحتوى النسخة. ما أُدخل بعد تاريخ النسخة يضيع — فخذ
            نسخة من الوضع الحالي أولاً إن كنت غير متأكّد.
          </Note>
        </HelpSection>
      </div>
    ),
  },

  // ------------------------------------------------------------------ users & security
  {
    id: "users",
    title: "المستخدمون والأمان",
    icon: UsersIcon,
    render: (locale) => (
      <div className="space-y-4">
        <HelpSection title="الحسابات" icon={UsersIcon}>
          <p>
            يأتي البرنامج بحساب مسؤول ثابت <Code>admin@spir.local</Code> يعمل دون قاعدة بيانات، ليمكن الدخول من أول
            لحظة. استخدمه للإعداد، ثم أنشئ حساباً باسم كل موظّف من{" "}
            <UiPath parts={[t(locale, "Setup"), t(locale, "Users")]} href="/users" /> — فسجلّ التغييرات يحفظ بريد من غيّر كل
            شيء، والحساب المشترك لا يخبرك من فعل ماذا.
          </p>
          <Pairs
            head={["الدور", "ما يستطيعه"]}
            rows={[
              [t(locale, "admin"), "كل شيء، ومعه الإعدادات والمستخدمون والنسخ الاحتياطي وسجلّ التدقيق."],
              [t(locale, "manager"), "العمل اليومي كلّه، ومعه صفحات المراقبة (الأخطاء، والتغييرات، والمزامنة)."],
              [t(locale, "staff"), "العمل اليومي: البيع والشراء والمخزون والصيانة والتقارير."],
            ]}
          />
          <p>
            الحساب الذي يغادر صاحبه يُعطَّل من صفحة المستخدمين بدل حذفه، فتبقى سجلّاته مفهومة. ولمنع حساب من أقسام بعينها:{" "}
            <UiPath parts={[t(locale, "Settings"), t(locale, "Feature access")]} href="/settings" />.
          </p>
        </HelpSection>

        <HelpSection title="كلمة المرور" icon={KeyRoundIcon}>
          <p>
            يغيّر كل موظّف كلمة مروره من صفحة <UiPath parts={[t(locale, "Account")]} href="/account" /> (بالنقر على اسمه أعلى
            الشاشة). ثماني خانات على الأقل.
          </p>
          <p>كلمة مرور الحساب الثابت <Code>admin@spir.local</Code> لا تتغيّر — ولهذا لا يُستخدم للعمل اليومي.</p>
        </HelpSection>

        <HelpSection title="لماذا البرنامج آمن على هذا الحاسوب" icon={ShieldIcon}>
          <Bullets>
            <li><strong>لا تصل إليه أجهزة الشبكة</strong>: يستمع لهذا الحاسوب وحده، ما لم يُثبَّت عمداً بالخيار <Code>-Lan</Code>.</li>
            <li><strong>لكل تثبيت مفتاح جلسات خاص به</strong>، يُولَّد تلقائياً. لا تنسخ الملف <Code>.env.local</Code> إلى حاسوب آخر.</li>
            <li><strong>سجلّ لا يُمحى</strong>: كل تعديل وحذف في السجلّات المالية والحسّاسة محفوظ ولا يمكن تغييره.</li>
          </Bullets>
          <Note kind="warn">
            الخيار <Code>-Lan</Code> يفتح البرنامج لكل أجهزة الشبكة، والحساب الثابت يعمل من أيٍّ منها. لا تستخدمه إلا على
            شبكة موثوقة، وقفل شاشة الحاسوب حين تتركه (<Key>Win</Key>+<Key>L</Key>).
          </Note>
        </HelpSection>
      </div>
    ),
  },

  // ------------------------------------------------------------------ troubleshooting
  {
    id: "troubleshooting",
    title: "حلّ المشكلات",
    icon: LifeBuoyIcon,
    render: (locale) => (
      <div className="space-y-4">
        <HelpSection title="أسئلة شائعة" icon={LifeBuoyIcon}>
          <Pairs
            head={["المشكلة", "الحلّ"]}
            rows={[
              ["البرنامج لا يُفتح",
                <span key="a">انتظر دقيقة بعد تشغيل الحاسوب، ثم افتح أيقونة Spir-Margin — فهي تشغّله إن كان متوقّفاً. إن استمرّ، أعد تشغيل الحاسوب.</span>],
              ["«الكمية غير كافية» عند البيع",
                <span key="b">لا توجد دفعة مستلَمة تكفي. سجّل استلام دفعة من <UiPath parts={[t(locale, "Stock"), t(locale, "Kits")]} href="/kits" /> ثم أعد البيع.</span>],
              ["التاريخ على المستندات غير صحيح",
                <span key="c">البرنامج يأخذ التاريخ من ساعة الحاسوب. تأكّد أن المنطقة الزمنية في ويندوز هي بغداد (UTC+3) وأن الساعة مضبوطة.</span>],
              ["«فشلت المزامنة»",
                <span key="d">البيانات محفوظة على هذا الحاسوب ولم يضع شيء. السبب والمحاولة من جديد في <UiPath parts={[t(locale, "Monitoring"), t(locale, "Sync Health")]} href="/monitoring/sync" />.</span>],
              ["رقم مستند مكرّر بين حاسوبين",
                <span key="e">لا يحدث: لكل حاسوب بادئة أو علامة خاصّة به. إن أردت أن تكون البادئة مقروءة فاضبطها في هوية الشركة.</span>],
              ["عنصر في القائمة لا يُفتح",
                <span key="f">ربما عطّله المسؤول أو منع حسابك منه، من <UiPath parts={[t(locale, "Settings"), t(locale, "Non-essential features")]} href="/settings" />.</span>],
            ]}
          />
        </HelpSection>

        <HelpSection title="أين أجد سجلّ الأخطاء">
          <Bullets>
            <li>داخل البرنامج: <UiPath parts={[t(locale, "Monitoring"), t(locale, "Error Monitor")]} href="/monitoring/errors" /> (للمسؤول والمدير).</li>
            <li>على ويندوز، إن لم يبدأ البرنامج أصلاً: الملف <Code>logs\spir-margin.log</Code> داخل مجلّد البرنامج.</li>
          </Bullets>
          <p>عند طلب المساعدة أرسل هذا الملف مع وصف ما حدث ووقته.</p>
        </HelpSection>
      </div>
    ),
  },
];
