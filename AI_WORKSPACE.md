# NAVIXA — مساحة العمل المشتركة

آخر تحديث: 2026-09-12

## حالة العمل

- الوكيل النشط: ChatGPT
- المهمة الحالية: تجهيز إطلاق الجمع البشري الحقيقي لـNameSense عبر دفعات دعوات آمنة ومتوازنة بدل إنشاء 225 رابطًا يدويًا.
- الحالة: PR #192 مفتوح كـDraft على فرع `feat/namesense-human-rollout-batches-20260912` بانتظار Verify + Pre-Launch على آخر head.
- الملفات المحجوزة: `app/api/admin/namesense-benchmark/invites/route.ts`, `app/admin/namesense-benchmark/invites/page.tsx`, `app/admin/namesense-benchmark/invites/invites.css`, `tests/namesense-study-batches.test.ts`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## آخر ما اكتمل

- دُمج PR #179 لبناء بوابة benchmark بشرية صارمة لـNameSense تشمل مجموعات اللهجات/اللكنات المطلوبة، حدود Wilson 95%، متطلبات تنوع صارمة، استبعاد الصوت الاصطناعي من دليل الاعتماد، فحص جودة الإشارة RMS/variance/VAD، ومنع تسرب المتحدثين بين مجموعات اللهجات. لا توجد حتى الآن نسبة دقة بشرية معلنة قبل جمع البيانات المؤهلة.
- دُمج PR #184 ونُشر على الإنتاج بنجاح: جامع داخلي محمي للـNameSense human holdout benchmark داخل `/admin/namesense-benchmark` مع API إدارة وD1 دون حفظ الصوت الخام أو transcript أو هوية الحساب.
- دُمج PR #188 ونُشر على الإنتاج: مسار مشاركة بشرية محكوم بدعوات محدودة لكل متحدث عبر `/namesense-study#invite=...`، مع token مخزن hash فقط، browser binding، server-owned prompts وground truth، ومنع multi-tab races.
- دُمج PR #191 ونُشر على الإنتاج لتحسين الحالة البصرية الآمنة للرابط المفقود/المنتهي دون تغيير منطق NameSense.
- تم فحص الإنتاج فعليًا عبر Chromium بعد النشر: الصفحة الرئيسية ومسار الدراسة يعملان، ومسار token وهمي يصل إلى API/D1 ويرفض بأمان دون تسريب token في DOM.
- الصوت الخام وtranscript لا يُخزنان ولا يُرسلان للخادم، ومسار الدراسة لا يعدّل حالة NameSense الإنتاجية أو تلميحات اللغة أو الكلمات المراقبة.
- أضيف في PR #192 إنشاء دفعات من 1 إلى 25 رابطًا، cleanup لأي دفعة غير مكتملة، تصدير CSV محلي، ومصفوفة تجنيد للمجموعات التسع مقابل هدف 25 متحدثًا لكل مجموعة.

## التالي

- تشغيل Verify + Pre-Launch على آخر head لـPR #192 وإصلاح أي فشل بدون تجاوز البوابات.
- مراجعة أن batch API لا يعيد/يخزن raw token إلا لحظة الإنشاء، وأن CSV يبقى محليًا في المتصفح.
- بعد النجاح: تحديث AI_CHANGELOG وتحرير الحجز، تحويل PR #192 إلى Ready ثم الدمج والنشر.
- فحص production smoke وواجهة إدارة الدفعات بعد النشر قبل إنشاء أي دفعة بشرية حقيقية.
