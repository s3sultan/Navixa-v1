# NAVIXA — مساحة العمل المشتركة

آخر تحديث: 2026-09-12

## حالة العمل

- الوكيل النشط: ChatGPT
- المهمة الحالية: بناء المرحلة الأولى من `NAVIXA UI System` بنظام واجهة Responsive مملوك للمشروع وقابل للتطوير والاستبدال، دون اعتماد Runtime جديد على مكتبة واجهات خارجية.
- الحالة: PR #193 Draft على الفرع `feat/navixa-ui-system-20260912`؛ الإنتاج غير متأثر. الفرع محدث مع آخر `master` (`behind=0`). آخر head اجتاز `Verify NAVIXA Pull Request` و`NAVIXA Pre-Launch Gate` و`Release gate`، ونجح Workflow مستقل في التقاط أدلة بصرية حقيقية للجوال والـDrawer والتابلت والكمبيوتر. تمت مراجعة الصور وتصحيح تغطية الـSplash لمسار `/ui-lab` فقط وتنقيح النصوص، دون تغيير واجهة الإنتاج.
- الملفات المحجوزة: `app/ui-system/*`, `app/ui-lab/*`, `tests/navixa-ui-system.test.ts`, `tests/ui-smoke.mjs`, `tests/ui-system-smoke.mjs`, `package.json`, `PROJECT_MEMORY.md`, `AI_CHANGELOG.md`, `AI_WORKSPACE.md`, `.github/workflows/ui-system-preview.yml`.

## مهمة موازية غير متقاطعة — NAVIXA Dev Guardian Foundation

- الوكيل: ChatGPT.
- المهمة: بناء الأساس الأول لـ`NAVIXA Repo Intelligence` و`Scope/Budget/Stuck Guards` دون إدخال Runtime خارجي ودون لمس ملفات UI System المحجوزة.
- الحالة: مكتملة؛ دُمج PR #194 إلى `master` ونُشر بنجاح عبر `Deploy NAVIXA Auto` بعد نجاح الفحوص وProduction smoke.
- الملفات المحجوزة لهذه المهمة: محررة؛ لا يوجد حجز نشط لهذه المهمة.
- القيود: لا يوجد تنفيذ إضافي ضمن هذه المهمة إلا بطلب جديد.

## مهمة موازية غير متقاطعة — NAVIXA Security Validation

- الوكيل: ChatGPT.
- المهمة: إضافة فحوص أمن تطبيق تلقائية في CI وتقارير قابلة للتدقيق دون تغيير Runtime للموقع أو ملفات UI System.
- الحالة: حجز فقط؛ التنفيذ سيكون على فرع معزول وPull Request مستقل، ولا يوجد دمج أو نشر إنتاجي قبل نجاح الفحوص والمراجعة.
- الملفات المحجوزة: `.github/workflows/security-*.yml`, `.github/workflows/codeql*.yml`, `security/*`, `NAVIXA_SECURITY_SCAN.md`.
- القيود: لا تعديل لـ`package.json` أو ملفات PR #193، وتكون اختبارات الموقع الخارجية غير مدمرة ومحدودة النطاق.

## مهمة موازية غير متقاطعة — NAVIXA Watch Alerts Phase 1

- الوكيل: ChatGPT.
- المهمة: توسيع محرك Web Push الحالي لتنبيهات عالية الأولوية تصل إلى iPhone وApple Watch المقترنة، مع إجراءات سريعة كتحسين تدريجي وFallback آمن عند عدم دعم الأزرار.
- الحالة: التنفيذ والتحقق مكتملان على Draft PR #210 في الفرع `feat/watch-alerts-20260912`، والإنتاج غير متأثر. نجحت `Verify NAVIXA Pull Request` #589 و`NAVIXA Pre-Launch Gate` #490 و`NAVIXA Security Code Scan` #37، بما يشمل CodeQL وTrivy وبوابات High/Critical. التوقف الحالي عند مراجعة المستخدم قبل أي دمج أو نشر أو مرحلة ثانية.
- الملفات المحجوزة لهذه المهمة: محررة؛ لا يوجد حجز نشط لهذه المهمة حتى يطلب المستخدم المرحلة التالية.
- القيود: لم تُلمس ملفات UI System أو `package.json`، ولم يُضف Runtime أو اعتماد جديد، ولا يوجد ادعاء تطبيق watchOS أصلي؛ Apple Watch تعتمد في هذه المرحلة على إشعارات Web Push المنعكسة من iPhone. أزرار الإجراءات تحسين تدريجي، ولم يُضف زر غفوة صوري قبل وجود جدولة خلفية حقيقية.

## آخر ما اكتمل

- اكتملت المرحلة الأولى من NAVIXA Watch Alerts على Draft PR #210 دون نشر: أولوية ذكية حسب نوع التنبيه، إجراءات `فتح NAVIXA` و`تم` مع fallback آمن، تحقق server-side لمدخلات مختبر Push وروابط الإجراءات الداخلية فقط، ونجاح جميع بوابات PR والإطلاق والأمن.
- دُمج PR #194 وبات NAVIXA Dev Guardian موجودًا على `master` والإنتاج، مع Repo Intelligence وTask Contract وGuards وEvidence Aggregator وDeveloper Bridge وPatch Producer محدود، ونجح Deploy NAVIXA Auto واختبارات الإنتاج.
- دُمج PR #179 لبناء بوابة benchmark بشرية صارمة لـNameSense تشمل مجموعات اللهجات/اللكنات المطلوبة، حدود Wilson 95%، متطلبات تنوع صارمة، استبعاد الصوت الاصطناعي من دليل الاعتماد، فحص جودة الإشارة RMS/variance/VAD، ومنع تسرب المتحدثين بين مجموعات اللهجات. لا توجد حتى الآن نسبة دقة بشرية معلنة قبل جمع البيانات المؤهلة.
- دُمج PR #184 ونُشر على الإنتاج بنجاح: جامع داخلي محمي للـNameSense human holdout benchmark داخل `/admin/namesense-benchmark` مع API إدارة وD1 دون حفظ الصوت الخام أو transcript أو هوية الحساب.
- اكتمل PR #188 لبناء مسار مشاركة بشرية محكوم بدعوات محدودة دون فتح صلاحيات الإدارة، مع رابط fragment، token 256-bit مخزنًا كـSHA-256 فقط، binding لأول متصفح، ground truth مملوك للخادم، توازن hit/miss، prompt assignment حرفي من الخادم، وحماية من multi-tab races.
- أضيفت صفحة إدارة للدعوات ومسار مشارك عام `/namesense-study#invite=...` وmigration `0053_namesense_study_invites.sql` وطبقة تخزين مشتركة واختبارات انحدار للأمان ونزاهة القياس.
- الصوت الخام وtranscript لا يُخزنان ولا يُرسلان للخادم، ومسار الدراسة لا يعدّل حالة NameSense الإنتاجية أو تلميحات اللغة أو الكلمات المراقبة.
- نجح آخر head موثق لـPR #188 في Verify NAVIXA Pull Request #437 وNAVIXA Pre-Launch Gate #320 شاملًا lint والاختبارات وUI smoke وبناء الإنتاج وفحص الاعتماديات والأسرار وGitHub Actions.
- المراجعة المستقلة النهائية لم تجد MAJOR/BLOCKER، مع بقاء الحكم الحقيقي لدقة NameSense معتمدًا فقط على corpus بشري مؤهل وتشغيل scorer الصارم.
- اكتملت المرحلة الأولى من PR #193: نظام Responsive مملوك لـNAVIXA، Sidebar/rail/bottom navigation، Drawer وOverlay مع عقود الوصول، primitives داخلية، مختبر `/ui-lab` غير مفهرس، واختبارات تمنع إدخال UI runtime خارجي إلى النواة.
- آخر head موثق لـPR #193 هو `64ccb5f6dd8b5af7b75b63374d7d54952d6780c3`: نجح Verify #522 وPre-Launch #417 وRelease gate، إضافة إلى `NAVIXA UI System Preview` #3. أدلة المعاينة: 390px للجوال، Drawer للجوال، 820px للتابلت، و1440px للكمبيوتر.
- المراجعة البصرية للأدلة النهائية لم تظهر overflow أو تداخلًا أو تغطية من Splash؛ الهوية فاتحة وتركوازية ومتسقة، والتنقل يتغير فعليًا حسب فئة الجهاز.

## التالي

- انتظار مراجعة المستخدم لـDraft PR #210 قبل أي دمج أو نشر أو بدء جدولة غفوة حقيقية/مرحلة ثانية لتنبيهات الساعة.
- تنفيذ NAVIXA Security Validation على فرع مستقل بفحوص كود واعتماديات وتحقق غير مدمر للموقع وتقارير CI.
- إبقاء PR #193 Draft دون دمج أو نشر إلى أن يراجع المستخدم صور المعاينة ويعتمد الاتجاه البصري.
- بعد الاعتماد فقط: التخطيط لنقل أول جزء من واجهة الإنتاج إلى النظام الجديد تدريجيًا مع بوابة رجوع واضحة، دون إعادة بناء الموقع دفعة واحدة.
- تبقى متابعة PR #188 ونشر NameSense مسارًا مستقلًا ولا تتداخل ملفاته مع هذه المهمة.
