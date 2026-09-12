# NAVIXA Dev Guardian

هذه الطبقة تطوّر منظومة الوكلاء الحالية داخل NAVIXA بدل استبدالها أو إدخال إطار تشغيل خارجي كامل. الهدف هو إضافة فهم آلي للمستودع، توجيه قابل للتدقيق، وحدود توقف واضحة فوق بروتوكولات NAVIXA الحالية وGitHub Actions الموجودة أصلًا.

## مبادئ ثابتة

- GitHub و`master` يبقيان المصدر الرسمي.
- لا وكيل يدمج أو ينشر بنفسه.
- لا أسرار أو صلاحيات إنتاج داخل Dev Guardian.
- كل تغيير كتابي يظل في branch/PR معزولًا حتى اجتياز فحوص NAVIXA الحالية.
- Dev Guardian لا يستبدل `pr-verify` أو `pre-launch-gate`؛ يعمل قبلهما وفوقهما.
- أي مخرجات ذكاء خارجي تعامل كمادة غير موثوقة حتى تمر بالمراجعة والفحوص.

## خط التنفيذ المستهدف

```text
NAVIXA Repo Intelligence
        ↓
NAVIXA Planner
        ↓
NAVIXA Agent Router
        ↓
Developer Agent
        ↓
Existing NAVIXA Tests
        ↓
AI Tester
        ↓
Security Reviewer
        ↓
Independent Reviewer
        ↓
NAVIXA Pre-Launch Gate
        ↓
Merge
```

ويحيط بالمسار كاملًا:

```text
Scope Guard + Budget Guard + Stuck Detector
```

## المرحلة الأولى المنفذة في هذا الفرع

### 1. Repo Intelligence

الملف: `scripts/dev-guardian/repo-intelligence.mjs`

يبني snapshot بنيويًا من المستودع دون أي اتصال خارجي أو اعتماديات جديدة، ويستخرج:

- صفحات وAPI routes.
- GitHub Actions workflows.
- migrations.
- import/dependency graph.
- reverse dependency graph لمعرفة أثر تغيير ملف على بقية المشروع.
- ربط الاختبارات بالملفات التي تعتمد عليها.
- hotspots تقريبية مبنية على الوارد/الصادر/الاختبارات ونقاط الدخول.
- imports الداخلية غير المحلولة.
- الاعتماديات الخارجية المرصودة في imports.

يدعم مسار NAVIXA المختصر `@/` إضافة إلى relative imports.

أمثلة تشغيل:

```bash
node scripts/dev-guardian/repo-intelligence.mjs --root . --check
node scripts/dev-guardian/repo-intelligence.mjs --root . --json
node scripts/dev-guardian/repo-intelligence.mjs --root . --json --output /tmp/navixa-repo-map.json
```

هذه الخريطة لا تقرر وحدها أين يعدّل الوكيل؛ هي evidence إضافي للـPlanner والـRouter.

### 2. Scope Guard

الملف: `scripts/dev-guardian/guards.mjs`

يطبق allow/deny patterns على الملفات قبل السماح للوكيل بالاستمرار. أي ملف خارج النطاق أو داخل forbidden scope ينتج قرار توقف واضحًا.

النطاقات المحظورة الافتراضية تشمل أمثلة حساسة مثل `.env` والمفاتيح الخاصة، ويمكن للمهمة إضافة قيود أشد.

### 3. Budget Guard

يستطيع وقف المهمة عند أحد الحدود التالية:

- `maxSteps`
- `maxCostUsd`
- `maxTokens`
- `maxWallMs`

حدود الوقت في GitHub Actions تبقى موجودة كطبقة ثانية مستقلة.

### 4. Stuck Detector

يكشف أربع حالات أولية:

- تكرار نفس الفعل والنتيجة.
- تكرار نفس الخطأ.
- سلسلة فشل متتالية.
- oscillation من نوع A/B/A/B/A/B.
- ثبات `progressHash` عدة خطوات دون تقدم.

الهدف أن يتوقف الوكيل ويرجع تقريرًا بدل استهلاك وقت أو تكلفة وهو يدور في الحلقة نفسها.

### 5. Agent Router

الملف: `scripts/dev-guardian/router.mjs`

المرحلة الأولى Router حتمي وقابل للمراجعة، وليس LLM يقرر وحده. يعتمد على:

- مستوى الخطورة.
- هل المهمة تحتاج كتابة أم قراءة فقط.
- حساسية الأمان/المصادقة/الفوترة/الأسرار/webhooks.
- تأثير UI/visual.
- التكاملات الخارجية.
- حجم التغيير المتوقع.

ويعيد:

- الوكيل الأساسي المقترح.
- المراجعين المطلوبين.
- الفحوص الإلزامية.
- بوابات اعتماد المستخدم.
- حدود الخطوات والوقت وسياسات التوقف.

لا يستدعي الوكلاء بنفسه في هذه المرحلة؛ الربط الفعلي بالـBridges الحالية يأتي بعد اجتياز هذا الأساس للمراجعة.

## التحقق

`tests/dev-guardian.test.mjs` يغطي:

- allow/deny scope.
- حدود الميزانية.
- repeated-error وoscillation.
- مسار صحي غير عالق.
- تصعيد المهمة الأمنية لمراجعة مستقلة.
- Repo Intelligence على مستودع fixture يشمل route وalias وreverse dependencies وربط test.

`.github/workflows/dev-guardian-verify.yml` يشغل هذه الاختبارات ويبني Repo Intelligence snapshot للمستودع الحقيقي ويتحقق من عقد JSON، دون `npm install` ودون مفاتيح أو اتصالات خارجية.

## ما لم يتم بعد عمدًا

- لا تعديل على `package.json` بسبب حجزه حاليًا لمهمة UI System الموازية.
- لا استدعاء تلقائي لـCodex/Claude/Manus/Gemini من Router حتى نعتمد عقد التنفيذ بعد نجاح المرحلة الأولى.
- لا AI Tester يكتب أو يصلح تلقائيًا بعد.
- لا تعديل على `pr-verify` أو `pre-launch-gate`.
- لا دمج ولا نشر إنتاجي ضمن هذه المرحلة.

## المرحلة التالية بعد نجاح الأساس

1. إضافة Task Contract موحد يربط بيانات Issue مع Repo Intelligence وRouter.
2. تمرير `allowed_scope`, `forbidden_scope`, budget وbase commit آليًا لكل Bridge.
3. إضافة سجل أحداث موحد لكي يعمل Stuck Detector أثناء التنفيذ الفعلي.
4. بناء Independent Review dispatcher يضمن اختلاف المراجع عن المنفذ.
5. إضافة AI Tester محدود القراءة/التنفيذ يركز على الفجوات التي لا تغطيها الاختبارات الحالية.
6. بعد إثبات الثبات فقط، إدخال Dev Guardian كفحص مطلوب قبل `pre-launch-gate` دون تخفيف أي بوابة حالية.
