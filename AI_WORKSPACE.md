# NAVIXA — مساحة العمل المشتركة

آخر تحديث: 2026-09-12

## حالة العمل

- الوكيل النشط: ChatGPT
- المهمة الحالية: بناء المرحلة الأولى من `NAVIXA UI System` بنظام واجهة Responsive مملوك للمشروع وقابل للتطوير والاستبدال، دون اعتماد Runtime جديد على مكتبة واجهات خارجية.
- الحالة: PR #193 Draft على الفرع `feat/navixa-ui-system-20260912`؛ الإنتاج غير متأثر. أول فحص كشف lint على رابط داخلي وتم إصلاحه؛ الفحص التالي أثبت نجاح 245 اختبارًا وكشف أن قياس Drawer تم أثناء حركة الدخول، لذلك يُفصل فحص الـUI System في smoke مستقل أكثر ثباتًا.
- الملفات المحجوزة: `app/ui-system/*`, `app/ui-lab/*`, `tests/navixa-ui-system.test.ts`, `tests/ui-smoke.mjs`, `tests/ui-system-smoke.mjs`, `package.json`, `PROJECT_MEMORY.md`, `AI_CHANGELOG.md`, `AI_WORKSPACE.md`.

## مهمة موازية غير متقاطعة — NAVIXA Dev Guardian Foundation

- الوكيل: ChatGPT.
- المهمة: بناء الأساس الأول لـ`NAVIXA Repo Intelligence` و`Scope/Budget/Stuck Guards` دون إدخال Runtime خارجي ودون لمس ملفات UI System المحجوزة.
- الحالة: حجز فقط؛ التنفيذ سيكون على فرع معزول وPull Request مستقل، ولا يوجد نشر أو تعديل إنتاجي مباشر.
- الملفات المحجوزة لهذه المهمة: `scripts/dev-guardian/*`, `tests/dev-guardian.test.mjs`, `.github/workflows/dev-guardian-verify.yml`, `NAVIXA_DEV_GUARDIAN.md`.
- القيود: لا تعديل لـ`package.json` أو ملفات PR #193، ولا دمج أو نشر قبل نجاح الفحوص والمراجعة.

## آخر ما اكتمل

- دُمج PR #179 لبناء بوابة benchmark بشرية صارمة لـNameSense تشمل مجموعات اللهجات/اللكنات المطلوبة، حدود Wilson 95%، متطلبات تنوع صارمة، استبعاد الصوت الاصطناعي من دليل الاعتماد، فحص جودة الإشارة RMS/variance/VAD، ومنع تسرب المتحدثين بين مجموعات اللهجات. لا توجد حتى الآن نسبة دقة بشرية معلنة قبل جمع البيانات المؤهلة.
- دُمج PR #184 ونُشر على الإنتاج بنجاح: جامع داخلي محمي للـNameSense human holdout benchmark داخل `/admin/namesense-benchmark` مع API إدارة وD1 دون حفظ الصوت الخام أو transcript أو هوية الحساب.
- اكتمل PR #188 لبناء مسار مشاركة بشرية محكوم بدعوات محدودة دون فتح صلاحيات الإدارة، مع رابط fragment، token 256-bit مخزن كـSHA-256 فقط، binding لأول متصفح، ground truth مملوك للخادم، توازن hit/miss، prompt assignment حرفي من الخادم، وحماية من multi-tab races.
- أضيفت صفحة إدارة للدعوات ومسار مشارك عام `/namesense-study#invite=...` وmigration `0053_namesense_study_invites.sql` وطبقة تخزين مشتركة واختبارات انحدار للأمان ونزاهة القياس.
- الصوت الخام وtranscript لا يُخزنان ولا يُرسلان للخادم، ومسار الدراسة لا يعدّل حالة NameSense الإنتاجية أو تلميحات اللغة أو الكلمات المراقبة.
- نجح آخر head موثق لـPR #188 في Verify NAVIXA Pull Request #437 وNAVIXA Pre-Launch Gate #320 شاملًا lint والاختبارات وUI smoke وبناء الإنتاج وفحص الاعتماديات والأسرار وGitHub Actions.
- المراجعة المستقلة النهائية لم تجد MAJOR/BLOCKER، مع بقاء الحكم الحقيقي لدقة NameSense معتمدًا فقط على corpus بشري مؤهل وتشغيل scorer الصارم.

## التالي

- إعادة `tests/ui-smoke.mjs` لفحصه الأصلي وفصل `/ui-lab` في `tests/ui-system-smoke.mjs` على narrow/medium/wide مع انتظار استقرار الحركة قبل القياس.
- إكمال GitHub Actions على PR #193 وإصلاح أي فشل حتى تصبح البوابة نظيفة.
- توثيق التسليم وإبقاء PR Draft دون دمج حتى مراجعة المستخدم.
- بناء Dev Guardian Foundation على فرع مستقل: Repo Intelligence ثم Scope/Budget/Stuck Guards واختبار مستقل، دون لمس نطاق UI System.
- تبقى متابعة PR #188 ونشر NameSense مسارًا مستقلًا ولا تتداخل ملفاته مع هذه المهمة.
