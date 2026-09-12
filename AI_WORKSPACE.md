# NAVIXA — مساحة العمل المشتركة

آخر تحديث: 2026-09-12

## حالة العمل

- الوكيل النشط: لا يوجد
- المهمة الحالية: لا توجد مهمة محجوزة؛ جامع NameSense البشري داخل PR #184 اجتاز الفحوص والمراجعة المستقلة النهائية
- الحالة: جاهز للدمج بعد التحقق من head النهائي
- الملفات المحجوزة: لا يوجد

## آخر ما اكتمل

- دُمج PR #179 لبناء بوابة benchmark بشرية صارمة لـNameSense تشمل مجموعات اللهجات/اللكنات المطلوبة، حدود Wilson 95%، متطلبات تنوع صارمة، استبعاد الصوت الاصطناعي من دليل الاعتماد، فحص جودة الإشارة RMS/variance/VAD، ومنع تسرب المتحدثين بين مجموعات اللهجات. لا توجد حتى الآن نسبة دقة بشرية معلنة قبل جمع البيانات المؤهلة.
- جهز PR #184 جامعًا داخليًا محميًا للـNameSense human holdout benchmark داخل `/admin/namesense-benchmark` مع API إدارة وD1 دون حفظ الصوت الخام أو transcript أو هوية الحساب.
- وحّد PR #184 التقاط الميكروفون: local Whisper fallback يعيد استخدام `MediaStream` نفسه ولا يوقف stream لا يملكه، مع اختبار انحدار يمنع طلب ميكروفون ثانٍ.
- عزل benchmark عن حالة المستخدم: contextual bias مؤقت مع `learningEnabled=false`, `useStoredLanguageHint=false`, `persistLanguageHint=false` دون مسح أو تعديل watched terms أو aliases أو language hints.
- أضاف سجلًا ذريًا `navixa_namesense_benchmark_speakers` يحجز كل `speakerId` لمجموعة لهجة واحدة، مع `INSERT OR IGNORE` ثم تحقق accent ورفض mismatch لمنع سباقات الطلبات المتزامنة.
- شدد endpoint/VAD للـbenchmark: لا تتعلم أرضية الضوضاء من speech/transients، والعتبة المتكيفة محصورة بين protocol minimum `0.0035` و`0.01` مع اختبارات للكلام الهادئ والضوضاء.
- تسلسل المراجعات المستقلة لجامع PR #184: Issue #185 = `MAJOR`، ثم #186 = `MINOR`، ثم #187 = `CLEAR` بعد الإصلاحات.
- التحقق على كود head `49542d0590f53e1553f01d5c1a401468a385825b`: نجح Verify NAVIXA Pull Request #423 وNAVIXA Pre-Launch Gate #302 وRelease Gate، شاملًا lint والاختبارات وUI smoke وبناء الإنتاج وتدقيق الاعتماديات والأسرار وGitHub Actions.
- لا توجد حتى الآن أي نسبة دقة بشرية لـNameSense؛ الخطوة العلمية التالية هي جمع corpus بشري مؤهل وتشغيل scorer الصارم فقط بعد اكتمال الحد الأدنى والتوازن.

## التالي المقترح

- إعادة تحقق CI على head النهائي بعد تحديثات التوثيق، ثم دمج PR #184 إذا بقيت البوابات خضراء، ومراقبة Deploy NAVIXA Auto وsmoke checks على الإنتاج.
- بعد نجاح النشر: بدء جمع benchmark البشري الحقيقي حسب بروتوكول PR #179 دون إعلان أي نسبة قبل اكتمال corpus المؤهل.
