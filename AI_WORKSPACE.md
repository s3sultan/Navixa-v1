# NAVIXA — مساحة العمل المشتركة

آخر تحديث: 2026-09-12

## حالة العمل

- الوكيل النشط: ChatGPT
- المهمة الحالية: تحويل جامع NameSense البشري من أداة إدارة داخلية إلى مسار مشاركة بشرية محكوم وآمن باستخدام دعوات محدودة دون فتح صلاحيات الإدارة
- الحالة: قيد التنفيذ على فرع معزول بعد نجاح ونشر PR #184
- الملفات المحجوزة: `app/admin/namesense-benchmark/page.tsx`, `app/admin/namesense-benchmark/collector.css`, `app/admin/namesense-benchmark/invites/page.tsx`, `app/admin/namesense-benchmark/invites/invites.css`, `app/api/admin/namesense-benchmark/route.ts`, `app/api/admin/namesense-benchmark/invites/route.ts`, `app/api/admin/namesense-benchmark/schema.ts`, `app/api/namesense-study/route.ts`, `app/namesense-study/page.tsx`, `app/namesense-study/study.css`, `benchmarks/namesense/storage.ts`, `migrations/0053_namesense_study_invites.sql`, `tests/namesense-study.test.mjs`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`

## آخر ما اكتمل

- دُمج PR #179 لبناء بوابة benchmark بشرية صارمة لـNameSense تشمل مجموعات اللهجات/اللكنات المطلوبة، حدود Wilson 95%، متطلبات تنوع صارمة، استبعاد الصوت الاصطناعي من دليل الاعتماد، فحص جودة الإشارة RMS/variance/VAD، ومنع تسرب المتحدثين بين مجموعات اللهجات. لا توجد حتى الآن نسبة دقة بشرية معلنة قبل جمع البيانات المؤهلة.
- دُمج PR #184 ونُشر على الإنتاج بنجاح: جامع داخلي محمي للـNameSense human holdout benchmark داخل `/admin/namesense-benchmark` مع API إدارة وD1 دون حفظ الصوت الخام أو transcript أو هوية الحساب.
- وحّد PR #184 التقاط الميكروفون: local Whisper fallback يعيد استخدام `MediaStream` نفسه ولا يوقف stream لا يملكه، مع اختبار انحدار يمنع طلب ميكروفون ثانٍ.
- عزل benchmark عن حالة المستخدم: contextual bias مؤقت مع `learningEnabled=false`, `useStoredLanguageHint=false`, `persistLanguageHint=false` دون مسح أو تعديل watched terms أو aliases أو language hints.
- أضاف سجلًا ذريًا `navixa_namesense_benchmark_speakers` يحجز كل `speakerId` لمجموعة لهجة واحدة، مع `INSERT OR IGNORE` ثم تحقق accent ورفض mismatch لمنع سباقات الطلبات المتزامنة.
- شدد endpoint/VAD للـbenchmark: لا تتعلم أرضية الضوضاء من speech/transients، والعتبة المتكيفة محصورة بين protocol minimum `0.0035` و`0.01` مع اختبارات للكلام الهادئ والضوضاء.
- تسلسل المراجعات المستقلة لجامع PR #184: Issue #185 = `MAJOR`، ثم #186 = `MINOR`، ثم #187 = `CLEAR` بعد الإصلاحات.
- نجح Deploy NAVIXA Auto #81 بعد الدمج، شاملًا D1 migrations وWorker deploy وproduction smoke و`/api/sync` وsecurity headers.
- لا توجد حتى الآن أي نسبة دقة بشرية لـNameSense؛ الخطوة العلمية التالية هي جمع corpus بشري مؤهل وتشغيل scorer الصارم فقط بعد اكتمال الحد الأدنى والتوازن.

## التالي المقترح

- إنشاء مسار مشاركة بشرية محدود بدعوات عشوائية مخزنة كـhash في D1، مع تثبيت اللهجة لكل دعوة، سقف محاولات، انتهاء صلاحية، وموافقة صريحة.
- إبقاء الصوت الخام محليًا وعدم إرسال transcript أو أي معرف حساب، وربط السجلات بنفس scorer الصارم الحالي.
- إضافة مولد دعوات داخل جامع الإدارة لتشغيل الدراسة عمليًا دون أوامر يدوية.
- استخدام طبقة تخزين مشتركة بين مسار الإدارة ومسار الدراسة لتوحيد قيود D1 وعدم تكرار منطق النزاهة.
- فتح PR معزول، تشغيل Verify + Pre-Launch + مراجعة مستقلة، وعدم دمج/نشر أي مسار عام قبل إغلاق أي MAJOR/BLOCKER.
