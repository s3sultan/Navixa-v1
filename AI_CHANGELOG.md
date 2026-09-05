# NAVIXA — سجل عمل المساعدين

لا تُعدّل السجلات السابقة. أضف السجل الأحدث في الأعلى تحت هذا السطر.

## 2026-09-05 — Codex

- أصلح اختلاف Hydration في التحية، وبسّط الصفحة الرئيسية على سطح المكتب مع إبقاء الأدوات المساندة قابلة للوصول والمحافظة على تجربة الجوال المختصرة.
- ثبّت سلسلة التطوير وUI smoke على Windows، وحدّث رابط الإنتاج الرسمي إلى `https://navixasa.com` ووثّق بوابة الإصدار ومسار النشر التلقائي المحكوم.
- صحح تحقق staging بحيث لا يطلب تجربة CSP الخاصة بفرع `security/hardening-2026-09-04` من فروع الإصدار العادية، وأضاف تغطية انحدار للعقد.
- التحقق المنشور: نجح staging رقم `33978081612` وفحوص PR وبوابة الإصدار، ونجحت المراجعة البصرية المنشورة للجوال وسطح المكتب دون أخطاء Console.
- التحقق: نجح `npm run test:verify` بعد دمج أحدث `master` (lint + 115 اختبارًا + UI smoke + build)، ووجد تدقيق اعتماديات الإنتاج 0 ثغرات؛ ونجحت المراجعة البصرية للجوال وسطح المكتب دون أخطاء Console.
- الملفات: `app/page.tsx`, `app/navixa.css`, `.github/workflows/deploy-navixa-staging.yml`, `tests/mobile-home-simplification.test.ts`, `tests/ui-smoke.mjs`, `tests/launch-hardening.test.ts`, `package.json`, `eslint.config.mjs`, `AI_ONBOARDING.md`, `PROJECT_MEMORY.md`, `NAVIXA_RELEASE_EVIDENCE.md`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-31 — ChatGPT

- جهّز صفحات المراجعة العامة لمتطلبات مزودي الدفع: عرض حالة التجربة المجانية وسعرها الحالي 0 ر.س، توضيح Sprint وPlus، وإظهار روابط الشروط والخصوصية والاسترداد والتسليم والشكاوى والدعم.
- أخفى مسار عرض المؤسسين من الواجهة العامة بتحويله إلى Plus خلال الفترة المجانية، وصحح أسهم الروابط العربية في صفحة Plus.
- حدّث اختبار Plus ليمنع ظهور أسعار الاشتراك المدفوعة أو مسار دفع عام أثناء الفترة المجانية.
- الملفات: `app/review/page.tsx`, `app/plus/page.tsx`, `app/sprint/page.tsx`, `app/founders/page.tsx`, `tests/plus-page-simplification.test.ts`, `AI_CHANGELOG.md`.

## 2026-08-14 — Codex

- حدّث `actions/checkout` في جسري Manus وGemini من v4 إلى v6 دون تغيير الصلاحيات أو الأسرار أو منطق التشغيل.
- الملفات: `.github/workflows/manus-task.yml`, `.github/workflows/gemini-task.yml`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- حدّث إجراء نشر Cloudflare من `wrangler-action@v3` إلى الإصدار الرسمي `v4` دون تغيير الأسرار أو أمر النشر أو Worker المستهدف.
- الملفات: `.github/workflows/deploy-navixa.yml`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- استبدل اختبار قالب المعاينة القديم باختبار تصيير صفحة NAVIXA الحالية وبياناتها الوصفية العربية، وتحقق ببناء ناجح واختبار واحد ناجح دون فشل.
- الملفات: `tests/rendered-html.test.mjs`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- تحقق من نجاح أول اختبار حي لجسر Gemini للمهمة #3 وإعادة التقرير إلى GitHub دون تطبيق تغييرات، وتأكد من نجاح نشر NAVIXA للنسخة نفسها.
- الملفات: `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- أنشأ جسر Gemini API محكومًا يعيد النتائج إلى الـIssue، مع بوابة اعتماد المالك وسياق مستودع نصي محدود بالعدد والحجم والمسارات المذكورة في المهمة.
- حفظ مفتاح Gemini في GitHub Secret ضمن Free tier دون تفعيل فوترة، وأضاف اختبارًا معزولًا ناجحًا ومنعًا للمسارات غير الآمنة والإشارات النشطة.
- الملفات: `.github/workflows/gemini-task.yml`, `scripts/gemini-task-runner.mjs`, `tests/gemini-task-runner.test.mjs`, `AI_AGENT_REGISTRY.md`, `PROJECT_MEMORY.md`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- حسّن جسر Manus لنسخ المرفقات النصية الآمنة والمحدودة إلى تعليق GitHub، مع منع الروابط غير الآمنة والملفات الكبيرة وإبقاء المرفقات الأخرى داخل المهمة الخاصة.
- أضاف اختبارًا معزولًا يثبت وصول ملخص Manus والتقرير Markdown الكامل دون تفعيل الإشارات للمستخدمين.
- الملفات: `scripts/manus-task-runner.mjs`, `tests/manus-task-runner.test.mjs`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- صحح رمز لغة طلب Manus API من `ar-SA` غير المقبول إلى `ar` بعد اختبار الاتصال الحقيقي، وأضاف تحققًا يمنع رجوع الخطأ.
- الملفات: `scripts/manus-task-runner.mjs`, `tests/manus-task-runner.test.mjs`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- أنشأ جسر GitHub Actions محكومًا لتوزيع Issues المعتمدة على Manus API v2 وإعادة التقرير إلى نفس المهمة دون تطبيق أو دمج أو نشر.
- أضاف حراسة مالك المستودع، أقل صلاحيات GitHub، معالجة آمنة للمخرجات غير الموثوقة، واختبارًا معزولًا ناجحًا لمسار التنفيذ الكامل.
- الملفات: `.github/workflows/manus-task.yml`, `scripts/manus-task-runner.mjs`, `tests/manus-task-runner.test.mjs`, `AI_AGENT_REGISTRY.md`, `PROJECT_MEMORY.md`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- دمج بروتوكول غرفة التحكم المعتمد إلى `master`، ثم جهّز في فرع منفصل نموذج GitHub Issue للمهام، وقالب Pull Request للاعتماد، وسجل أدوار الوكلاء.
- التحقق: مراجعة القوالب ونجاح `git diff --check`؛ لا يوجد تعديل في كود المنتج أو نشر جديد.
- الملفات: `.github/ISSUE_TEMPLATE/ai-task.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/pull_request_template.md`, `AI_AGENT_REGISTRY.md`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- وثّق بروتوكول غرفة التحكم متعددة الذكاءات المعتمد بصيغة قابلة لإعادة الاستخدام، متضمنًا بطاقة ربط ورسائل فحص وتنفيذ واختبار قبول، وسجّل القرار الدائم في الذاكرة.
- تحقق من Claude وGemini AI Studio وManus باختبارات قراءة وبناء معزولة، وحدد لكل منهم دورًا بلا صلاحية دمج أو نشر.
- التحقق: مراجعة الوثيقة ونجاح `git diff --check`؛ لا يوجد تعديل منتج أو نشر.
- الملفات: `AI_COORDINATION_PROTOCOL.md`, `PROJECT_MEMORY.md`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.

## 2026-08-12 — Codex

- أضاف مسار GitHub Actions موحدًا لبناء NAVIXA ونشره تلقائيًا إلى Worker `navixa` عند تحديث كود `master`.
- استثنى تحديثات الذاكرة والحجز وحدها من النشر، ومنع تداخل عمليتي نشر.
- يتطلب التفعيل إضافة `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` إلى أسرار GitHub مرة واحدة.

## 2026-08-12 — Codex

- اعتمد GitHub مصدرًا رسميًا وCloudflare Worker `navixa` رابط إنتاج موحدًا، مع إلغاء اعتماد Zite دون حذفه.
- حسّن موثوقية الاستماع وحفظ كلمات المتابعة محليًا وتنظيف الميكروفون عند الإيقاف أو مغادرة الصفحة.
- التحقق: بناء الإنتاج نجح.
- الملفات: `PROJECT_MEMORY.md`, `app/page.tsx`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`.
- أضاف `AI_ONBOARDING.md` كبوابة موحدة ودائمة لانضمام Manus وأي مساعد مستقبلي.

## 2026-08-12 — Codex

- راجع تسليم Claude وبقية التغييرات المشتركة، وتحقق من النسخة كاملة ببناء إنتاج ناجح.
- جهّز ملفات التنسيق والذاكرة ومركز التنبيهات وتنظيم الواجهة ولوحة الإدارة للاعتماد في GitHub.
- استبعد ملفات البناء والتطوير المحلية من المصدر المشترك.

## 2026-08-12 — Claude

- أعاد تنظيم لوحة الإدارة: فصل «الإعدادات» عن «السجل» بمرساتين ونقطتي تنقل منفصلتين بدل دمجهما بلا عنوان.
- غلّف لوحات الإعدادات الأربع (AdminHealthSettings, AdminCounterSettings, AdminAssistantSettings, AdminAlertSettings) بعنوان قسم واضح `settings-group`/`settings-stack` بدون تغيير منطقها.
- لم يضف ميزات جديدة، فقط إعادة تنظيم بصري وهيكلي حسب الطلب.
- التحقق: TypeScript نظيف، السيرفر اشتغل بدون أخطاء.
- الملفات: `app/admin/page.tsx`, `app/admin/admin.css`.

## 2026-08-12 — Codex

- أنشأ نظام التنسيق المشترك بين Codex وClaude.
- أضاف تعليمات القراءة والحجز والتسليم وسجل التغييرات.
- الملفات: `AGENTS.md`, `CLAUDE.md`, `AI_WORKSPACE.md`, `AI_CHANGELOG.md`, `PROJECT_MEMORY.md`.
