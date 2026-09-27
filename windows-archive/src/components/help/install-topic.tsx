// Archived with the Windows version: the «التثبيت على ويندوز» tab of the in-app
// instructions, as it stood in src/components/help/topics.tsx (one entry of
// the TOPICS array). To bring it back, paste this entry back into TOPICS
// before the «settings» entry, and re-import MonitorDownIcon there.
// Not compiled (windows-archive/ is excluded in tsconfig.json).

  // ------------------------------------------------------------------ Windows install
  {
    id: "install",
    title: "التثبيت على ويندوز",
    icon: MonitorDownIcon,
    render: (locale) => (
      <div className="space-y-4">
        <HelpSection title="ما يلزم" icon={MonitorDownIcon}>
          <Bullets>
            <li>حاسوب بنظام <strong>ويندوز 10 أو 11</strong>، وعليه مساحة فارغة نحو 2 غيغابايت.</li>
            <li><strong>الإنترنت أثناء التثبيت فقط</strong>، لتنزيل مكوّنات البرنامج. بعدها يعمل دون إنترنت.</li>
            <li>متصفّح Edge (موجود في ويندوز أصلاً) أو Chrome — يفتح البرنامج في نافذة خاصة به.</li>
            <li>لا تلزم صلاحيّات المسؤول على ويندوز.</li>
          </Bullets>
        </HelpSection>

        <HelpSection title="الخطوة 1: ثبّت Node.js">
          <p>Node.js هو المحرّك الذي يشغّل البرنامج. يُثبَّت مرّة واحدة على الحاسوب.</p>
          <Steps>
            <li>افتح الموقع <Code>nodejs.org</Code> ونزّل نسخة <strong>LTS</strong> لويندوز (ملف ينتهي بـ <Code>.msi</Code>).</li>
            <li>شغّل الملف واضغط «Next» في كل الشاشات دون تغيير شيء، ثم «Install» ثم «Finish».</li>
            <li>لا حاجة لتفعيل خيار «Tools for Native Modules» إن ظهر.</li>
          </Steps>
        </HelpSection>

        <HelpSection title="الخطوة 2: ضع مجلّد البرنامج في مكانه الدائم">
          <Steps>
            <li>
              نزّل أحدث إصدار، الملف <Code>spir-margin.zip</Code>، من{" "}
              <Code>github.com/inzohussein-blip/Spir-Margin/releases/latest</Code>
            </li>
            <li>انقر عليه بالزر الأيمن ← «استخراج الكل» (Extract All).</li>
            <li>
              انقل المجلّد <Code>spir-margin</Code> الناتج إلى القرص <Code>C:</Code> وسمّه <Code>Spir-Margin</Code>، فيصير{" "}
              <Code>C:\Spir-Margin</Code>. افتحه وتأكّد أن الملف <Code>install-windows.cmd</Code> يظهر فيه مباشرةً، لا
              داخل مجلّد آخر.
            </li>
          </Steps>
          <Note kind="warn">
            البيانات تُحفظ <strong>داخل هذا المجلّد</strong>. لا تضعه على سطح المكتب ولا في «المستندات» (كثيراً ما
            يزامنهما OneDrive فيُفسد القاعدة)، ولا في «التنزيلات» (تُفرَّغ أحياناً)، ولا على فلاشة أو قرص شبكي. المثبِّت
            يرفض هذه الأماكن ويطلب نقل المجلّد.
          </Note>
        </HelpSection>

        <HelpSection title="الخطوة 3: شغّل المثبِّت">
          <Steps>
            <li>انقر نقراً مزدوجاً على <Code>install-windows.cmd</Code>.</li>
            <li>
              إن ظهرت شاشة زرقاء «حمى Windows جهاز الكمبيوتر» (Windows protected your PC): اضغط «مزيد من المعلومات»
              (More info) ثم «تشغيل على أي حال» (Run anyway). هذا يظهر لكل برنامج نُزّل من الإنترنت ولا يحمل توقيعاً تجارياً.
            </li>
            <li>
              تظهر نافذة سوداء تعرض التقدّم. <strong>لا تغلقها</strong> — المرّة الأولى تأخذ بضع دقائق.
            </li>
            <li>تظهر رسالة «تمّ تثبيت Spir-Margin». اضغط «موافق»، فيُفتح البرنامج في نافذته.</li>
            <li>اضغط أي مفتاح لإغلاق النافذة السوداء. البرنامج يبقى يعمل في الخلفية.</li>
          </Steps>
          <Pairs
            head={["ما يضيفه المثبِّت", "ماذا يفعل"]}
            rows={[
              ["أيقونة «Spir-Margin» على سطح المكتب وفي قائمة ابدأ", "تشغّل البرنامج إن كان متوقّفاً، وتنتظر جاهزيّته، ثم تفتحه في نافذة مستقلّة."],
              ["تشغيل تلقائي عند الدخول إلى ويندوز", "يعمل في الخلفية بلا نوافذ، ويعيد تشغيل نفسه إن توقّف."],
              ["قاعدة بيانات فارغة", "جاهزة لبيانات الشركة. إن وُجدت بيانات سابقة في المجلّد بقيت كما هي."],
            ]}
          />
        </HelpSection>

        <HelpSection title="الخطوة 4: أول دخول" icon={KeyRoundIcon}>
          <Steps>
            <li>
              ادخل بالحساب الثابت: البريد <Code>admin@spir.local</Code> وكلمة المرور <Code>123</Code>.
            </li>
            <li>
              <strong>غيّر كلمة المرور 123</strong> فوراً من{" "}
              <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Built-in account password")]} href="/settings#builtin" />.
            </li>
            <li>
              أدخل هوية الشركة من{" "}
              <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Company identity")]} href="/settings" />.
            </li>
            <li>
              أنشئ حساباً لكل موظّف من <UiPath parts={[t(locale, "Setup"), t(locale, "Users")]} href="/users" />، ومنها
              حساب «{t(locale, "admin")}» لك، ثم اعمل بحسابك لا بالحساب الثابت.
            </li>
          </Steps>
          <p>
            باقي الخطوات في <Link href="/help?tab=start" className="font-medium text-brand hover:underline">البدء السريع</Link>.
          </p>
        </HelpSection>

        <HelpSection title="تأكّد أن التثبيت سليم">
          <Steps>
            <li>أعد تشغيل الحاسوب وانتظر دقيقة بعد ظهور سطح المكتب.</li>
            <li>افتح أيقونة Spir-Margin. إن فُتح البرنامج فالتشغيل التلقائي يعمل.</li>
            <li>إن ظهرت صفحة «البرنامج لا يستجيب بعد» فانتظر — هي تعيد المحاولة وحدها وتفتح البرنامج حين يجهز.</li>
          </Steps>
        </HelpSection>

        <HelpSection title="التحديثات" icon={RefreshCwIcon}>
          <p>
            كل تعديل على البرنامج يُنشر <strong>إصداراً مرقّماً</strong> بعد أن تنجح كل فحوصه. البرنامج يسأل عن الإصدار
            الجديد وحده عدّة مرات في اليوم حين يتوفّر الإنترنت، ويظهر للمسؤول في الجرس إشعار «{t(locale, "A new release is available")}».
          </p>
          <Steps>
            <li>
              افتح <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Updates")]} href="/settings#updates" />.
            </li>
            <li>
              اضغط «{t(locale, "Update now")}». يأخذ البرنامج نسخة احتياطية أولاً، ثم ينزّل الإصدار ويجهّزه بجانب النسخة
              العاملة، وتبقى تعمل كالمعتاد بضع دقائق. بعدها يتوقّف البرنامج نحو دقيقة ويعود بالإصدار الجديد، وتعود الصفحة وحدها.
            </li>
            <li>
              أو فعّل «{t(locale, "Install new releases automatically")}» واختر ساعة لا يعمل فيها أحد. إن كان الحاسوب مطفأً في
              تلك الساعة فالتحديث يجري عند أول تشغيل بعدها.
            </li>
          </Steps>
          <Note>
            إن لم يعمل الإصدار الجديد على هذا الحاسوب، أُعيد السابق وبياناته كما كانت، تلقائياً. التحديث لا يلمس{" "}
            <Code>.pglite-data</Code> (البيانات) ولا <Code>.env.local</Code> (مفتاح الجلسات) ولا النسخ الاحتياطية. التفاصيل في{" "}
            <Code>logs\update.log</Code>.
          </Note>
          <Note kind="warn">
            الحواسيب المرتبطة بالمزامنة: حدّثها كلها في اليوم نفسه، وابدأ بالحاسوب الرئيسي. حاسوب بإصدار أقدم قد يرفض
            تغييرات لم يعرفها بعد، فتبقى معلّقة حتى يُحدَّث.
          </Note>
          <p>
            من خارج البرنامج: انقر نقراً مزدوجاً على <Code>update-windows.cmd</Code> في مجلّد البرنامج — يفعل ما يفعله الزرّ.
          </p>
        </HelpSection>

        <HelpSection title="نسخة ثُبّتت قبل نظام الإصدارات: مرّة واحدة يدوياً">
          <p>النسخ القديمة لا تعرف التحديث من الإعدادات بعد. حدّثها مرّة واحدة هكذا، وبعدها يكفي الزرّ:</p>
          <Steps>
            <li>
              خذ نسخة احتياطية من{" "}
              <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Backup and restore")]} href="/settings" />{" "}
              واحفظها خارج هذا الحاسوب.
            </li>
            <li>
              نزّل <Code>spir-margin.zip</Code> من صفحة الإصدارات:{" "}
              <Code>github.com/inzohussein-blip/Spir-Margin/releases/latest</Code>
            </li>
            <li>
              استخرجه، وانسخ <strong>محتويات</strong> المجلّد <Code>spir-margin</Code> الذي في داخله إلى داخل{" "}
              <Code>C:\Spir-Margin</Code>، واختر «استبدال الملفات» حين يسأل ويندوز.
            </li>
            <li>
              افتح موجّه الأوامر داخل المجلّد: انقر شريط العنوان في مستكشف الملفات، واكتب <Code>cmd</Code> واضغط{" "}
              <Key>Enter</Key>.
            </li>
            <li>
              اكتب <Code>install-windows.cmd -Update</Code> واضغط <Key>Enter</Key>. يوقف البرنامج، ويعيد بناءه، ثم يشغّله.
            </li>
          </Steps>
          <Note kind="warn">
            <strong>لا تحذف المجلّد القديم</strong> لتضع الجديد مكانه. في داخله <Code>.pglite-data</Code> (كل بيانات
            الشركة) و<Code>.env.local</Code> (مفتاح الجلسات). النسخ فوقه يُبقيهما كما هما.
          </Note>
        </HelpSection>

        <HelpSection title="النقل إلى حاسوب جديد" icon={HardDriveIcon}>
          <Steps>
            <li>على الحاسوب القديم: خذ نسخة احتياطية وانقلها إلى الحاسوب الجديد.</li>
            <li>على الحاسوب الجديد: ثبّت البرنامج بالخطوات 1–3 أعلاه.</li>
            <li>
              افتح <UiPath parts={[t(locale, "Setup"), t(locale, "Settings"), t(locale, "Backup and restore")]} href="/settings" />{" "}
              واختر ملف النسخة ثم «{t(locale, "Restore this backup")}».
            </li>
          </Steps>
          <p>لا تنسخ الملف <Code>.env.local</Code> بين حاسوبين — لكل تثبيت مفتاحه، وسيسجّل الجميع دخولهم من جديد فقط.</p>
        </HelpSection>

        <HelpSection title="خيارات المثبِّت">
          <p>تُكتب في موجّه الأوامر داخل مجلّد البرنامج (انظر خطوة فتحه أعلاه):</p>
          <Pairs
            rows={[
              [<Code key="w">update-windows.cmd</Code>, "ينزّل أحدث إصدار ويثبّته، كزرّ «حدّث الآن» في الإعدادات. يعمل بالنقر المزدوج أيضاً."],
              [<Code key="u">install-windows.cmd -Update</Code>, "بعد نسخ نسخة جديدة فوق المجلّد: يوقف البرنامج، ويعيد بناءه، ثم يشغّله."],
              [<Code key="p">install-windows.cmd -Port 3001</Code>, "إن كان برنامج آخر يستخدم المنفذ 3000. المثبِّت يكتشف ذلك ويقترحه."],
              [<Code key="x">install-windows.cmd -Uninstall</Code>, "يزيل الأيقونات والتشغيل التلقائي ويوقف البرنامج. لا يحذف البيانات."],
              [<Code key="d">install-windows.cmd -Demo</Code>, "قاعدة جديدة ببيانات تجريبية للتدريب — على حاسوب تدريب، لا على حاسوب العمل."],
              [<Code key="l">install-windows.cmd -Lan</Code>, "قديم: يفتح البرنامج لأجهزة شبكة المكتب دون ربط الأجهزة. الأفضل «الوصول من الأجهزة الأخرى» في صفحة المزامنة (انظر تبويبه)."],
            ]}
          />
        </HelpSection>

        <HelpSection title="إن تعثّر التثبيت" icon={LifeBuoyIcon}>
          <Pairs
            head={["الرسالة", "الحلّ"]}
            rows={[
              ["«لم يُعثر على Node.js»", "ثبّته (الخطوة 1). إن كان مثبّتاً فأعد تشغيل الحاسوب ثم شغّل المثبِّت من جديد."],
              ["«مجلّد البرنامج في مكان قد تضيع منه البيانات»", <span key="m">انقل المجلّد كاملاً إلى <Code>C:\Spir-Margin</Code> وشغّل المثبِّت من هناك.</span>],
              ["«المنفذ 3000 يستخدمه برنامج آخر»", <span key="p">ثبّت على منفذ آخر: <Code>install-windows.cmd -Port 3001</Code></span>],
              ["«تعذّر تنفيذ: npm …»", "تأكّد من الإنترنت ثم أعد المحاولة. إن تكرّر فقد يكون برنامج الحماية يمنع التنزيل: أوقفه مؤقّتاً أثناء التثبيت فقط."],
              ["البرنامج لا يُفتح بعد التثبيت", <span key="l">انتظر دقيقة ثم افتح الأيقونة. سجلّ الأخطاء في <Code>C:\Spir-Margin\logs\spir-margin.log</Code>.</span>],
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

