# NAVIXA Dev Guardian

هذه الطبقة تطوّر منظومة الوكلاء الحالية داخل NAVIXA بدل استبدالها أو إدخال إطار تشغيل خارجي كامل. الهدف هو إضافة فهم آلي للمستودع، توجيه قابل للتدقيق، حدود توقف واضحة، ومراجعة مستقلة فوق بروتوكولات NAVIXA الحالية وGitHub Actions الموجودة أصلًا.

## مبادئ ثابتة

- GitHub و`master` يبقيان المصدر الرسمي.
- لا وكيل يدمج أو ينشر بنفسه.
- لا أسرار أو صلاحيات إنتاج داخل Dev Guardian.
- كل تغيير كتابي يظل في branch/PR معزولًا حتى اجتياز فحوص NAVIXA الحالية.
- Dev Guardian لا يستبدل `pr-verify` أو `pre-launch-gate` ولا يخففهما.
- أي مخرجات ذكاء خارجي تعامل كمادة غير موثوقة حتى تمر بالمراجعة والفحوص.
- التخطيط المحلي لا يشغّل أي مزود خارجي. Gemini/Manus يحتاجان موافقة يدوية صريحة مستقلة.

## خط التنفيذ

```text
NAVIXA Repo Intelligence
        ↓
NAVIXA Task Contract
        ↓
NAVIXA Planner + Agent Router
        ↓
Executor Guard
        ↓
Developer Agent
        ↓
Existing NAVIXA Tests
        ↓
AI Tester (read-only)
        ↓
Independent Reviewer (+ security when required)
        ↓
Evidence Aggregator
        ↓
NAVIXA Pre-Launch Gate
        ↓
Merge
```

ويحيط بالمسار كاملًا:

```text
Scope Guard + Budget Guard + Stuck Detector + Live Event Ledger
```

## المرحلة الأولى: الأساس

### Repo Intelligence

الملف: `scripts/dev-guardian/repo-intelligence.mjs`

يبني snapshot بنيويًا من المستودع دون اتصال خارجي أو اعتماديات جديدة، ويستخرج الصفحات وAPI routes وworkflows وmigrations وdependency/reverse-dependency graph وروابط الاختبارات وhotspots والاعتماديات المرصودة.

### Scope / Budget / Stuck Guards

الملف: `scripts/dev-guardian/guards.mjs`

- Scope Guard يطبق allow/deny patterns ويرفض path traversal والمسارات المطلقة والمسارات الحساسة الافتراضية مثل `.env` والمفاتيح.
- Budget Guard يفرض حدود `maxSteps`, `maxCostUsd`, `maxTokens`, `maxWallMs`.
- Stuck Detector يكشف تكرار نفس الفعل/الخطأ، سلسلة الفشل، oscillation، وثبات progress hash دون تقدم.

### Agent Router

الملف: `scripts/dev-guardian/router.mjs`

Router حتمي وقابل للمراجعة يعتمد على مستوى الخطورة، الحاجة للكتابة، حساسية الأمان، UI، التكاملات الخارجية وحجم التغيير، ثم يحدد المنفذ والمراجعين والفحوص وبوابات الاعتماد وحدود التشغيل.

## المرحلة الثانية: Task Contract والربط المقيد

### Task Contract

الملف: `scripts/dev-guardian/task-contract.mjs`

يحوّل نموذج GitHub Issue المعتمد إلى عقد موحد يتضمن الهدف ومعايير القبول والخطورة والوكيل وbase commit وallowed/forbidden scope والميزانية وإشارات الحساسية وملفات context المختارة من Repo Intelligence. إذا غاب عنصر إلزامي أو كان base commit الصريح قديمًا تتوقف المهمة بدل التخمين.

### Guardian Planner

الملف: `scripts/dev-guardian/guardian-task-runner.mjs`

يبني Repo Intelligence ثم العقد والـRouter وReview Dispatch ويطبق الحد الأكثر تشددًا بين سياسة Router وميزانية المهمة، ويكتب Plan JSON قابلًا للتدقيق. هذه الخطوة لا تستدعي ذكاء خارجيًا.

### Independent Review Dispatch

الملف: `scripts/dev-guardian/review-dispatch.mjs`

- Gemini يعمل كـAI Tester قراءة فقط للمهمات التنفيذية.
- Manus يعمل كمراجع مستقل قراءة فقط.
- المراجع لا يجوز أن يكون نفس المنفذ.
- المراجعة الأمنية تندمج مع المراجع المستقل عندما يطلبها Router.

### External Review Bridge

الملف: `scripts/dev-guardian/external-review-runner.mjs`

قبل إرسال أي context يطبق Scope Guard ويمنع الأسرار وprivate keys وsymlinks والمسارات الخارجة عن الجذر، ويحد أحجام الملفات والسياق، ويفصل تعليمات الأمان عن البيانات غير الموثوقة. النتيجة تقرير مراجعة فقط ولا تطبق أو تدمج أو تنشر.

## المرحلة الثالثة: الحراسة الحية والحكم الموحد

### Live Event Ledger

الملف: `scripts/dev-guardian/event-ledger.mjs`

- يسجل أحداث التنفيذ في JSONL داخل مساحة تشغيل المهمة.
- لا يخزن نص نتائج المراجعة أو رسائل الخطأ الخام؛ يخزن بصمات SHA-256 قصيرة فقط لاكتشاف التكرار والدوران.
- يجمع usage للخطوات والتوكنز والتكلفة والوقت.
- يشغّل Scope/Budget/Stuck Guard على السجل الحي قبل الاستمرار وبعد كل مراجعة خارجية.
- السجل مؤقت ولا يصبح مخزنًا لمحتوى المستخدم أو الأسرار.

### Executor Guard

الملف: `scripts/dev-guardian/executor-guard.mjs`

هذا هو العقد الإلزامي لأي Bridge كتابي لاحق. لا يسمح للتنفيذ إذا:

- المنفذ مختلف عن المنفذ الذي حدده Router.
- base commit مختلف عن العقد.
- أي ملف معدل خارج `allowedScope` أو داخل `forbiddenScope`.
- Budget/Stuck Guard أوقف المهمة.
- Task Contract نفسه غير صالح.

إضافة Bridge كتابة مستقبلًا لا تعني منحه حرية المستودع؛ يجب تمرير قائمة الملفات المقترحة إلى Executor Guard قبل السماح بالتغيير.

### Evidence Aggregator

الملف: `scripts/dev-guardian/evidence-aggregator.mjs`

يجمع بصورة deterministic:

- حالة التخطيط والفحوص المطلوبة.
- نتيجة AI Tester.
- حكم Independent Reviewer.
- حالة Live Execution Guard.

AI Tester لا يطلب منه حكم `CLEAR/MINOR/MAJOR/BLOCKER` لأن دوره اكتشاف الفجوات. المراجع المستقل هو صاحب الحكم. `MINOR` يسمح بالاستمرار مع تسجيل الملاحظة، أما `MAJOR` أو `BLOCKER` أو غياب مراجعة إلزامية أو فشل Guard فينتج `BLOCK`.

### Workflow اليدوي

`.github/workflows/dev-guardian-task.yml`

مدخلاته `issue_number`, `approved`, `dispatch_external`. `approved=true` يبني الخطة فقط. لا يبدأ Gemini/Manus إلا إذا كان `dispatch_external=true` أيضًا والمشغل مالك المستودع. عند التشغيل الخارجي يستخدم المراجعان سجل الأحداث نفسه، ويستمر المراجع المستقل حتى لو فشل AI Tester كي لا تضيع الأدلة، ثم يشغل Evidence Aggregator الحكم النهائي.

## التحقق

- `tests/dev-guardian.test.mjs`: Repo Intelligence والـguards والـrouter.
- `tests/dev-guardian-stage2.test.mjs`: Task Contract، base commit، scope، budget، استقلال المراجع، bounded context وفصل تعليمات الأمان.
- `tests/dev-guardian-stage3.test.mjs`: عدم تخزين النص الخام في Event Ledger، كشف التكرار الحي، Executor Guard، Evidence Aggregator وأحكام CLEAR/MINOR/MAJOR.
- `.github/workflows/dev-guardian-verify.yml`: يشغل المراحل الثلاث ويفحص syntax للـrunners ويبني Repo Intelligence snapshot للمستودع الحقيقي.
- `pr-verify` و`pre-launch-gate` يبقيان كما هما ولا يتم تخفيف أي فحص موجود.

## ما لم يتم بعد عمدًا

- لا تعديل على `package.json` بسبب مهمة UI System الموازية.
- لا تشغيل خارجي تلقائي بسبب label أو push أو PR.
- لا AI Tester أو Reviewer يكتب في المستودع.
- لا دمج أو نشر إنتاجي من Dev Guardian.
- لم يُمنح أي مزود خارجي صلاحية تنفيذ كتابي.

## المرحلة التالية بعد نجاح المرحلة الثالثة

1. ربط أول Developer Bridge فعلي بـExecutor Guard بحيث يكون المنع تقنيًا قبل الكتابة لا مجرد سياسة.
2. تمرير أدلة PR checks الفعلية إلى Evidence Aggregator، لا أدلة workflow اليدوي فقط.
3. تجربة Dev Guardian على مهام منخفضة الخطورة ومقارنة false blocks/false passes.
4. بعد ثباته، جعل Dev Guardian فحصًا مطلوبًا قبل الدمج دون تخفيف `NAVIXA Pre-Launch Gate`.
