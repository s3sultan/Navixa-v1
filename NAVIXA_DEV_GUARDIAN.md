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
Guarded Developer Bridge
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

لا يسمح للتنفيذ إذا كان المنفذ مختلفًا عن Router، أو base commit مختلفًا عن العقد، أو أي ملف خارج النطاق، أو Budget/Stuck Guard أوقف المهمة، أو Task Contract غير صالح.

### Evidence Aggregator

الملف: `scripts/dev-guardian/evidence-aggregator.mjs`

يجمع بصورة deterministic حالة التخطيط والفحوص وAI Tester والمراجع المستقل وحالة Live Execution Guard. AI Tester لا يحتاج حكمًا نهائيًا، بينما المراجع المستقل يجب أن ينهي بسطر verdict صريح. `MINOR` يسمح بالاستمرار مع تسجيل الملاحظة، أما `MAJOR` أو `BLOCKER` أو غياب دليل إلزامي أو فشل Guard فينتج `BLOCK`. كما تُطابق المراجعة بالدور واسم الوكيل المحدد في الخطة، وليس بالدور وحده.

### Workflow اليدوي

`.github/workflows/dev-guardian-task.yml`

مدخلاته `issue_number`, `approved`, `dispatch_external`. `approved=true` يبني الخطة فقط. لا يبدأ Gemini/Manus إلا إذا كان `dispatch_external=true` أيضًا والمشغل مالك المستودع. عند التشغيل الخارجي يستخدم المراجعان سجل الأحداث نفسه، ويستمر المراجع المستقل حتى لو فشل AI Tester كي لا تضيع الأدلة، ثم يشغل Evidence Aggregator الحكم النهائي.

## المرحلة الرابعة: Guarded Developer Bridge

### Patch Developer Bridge

الملف: `scripts/dev-guardian/patch-developer-bridge.mjs`

هذا أول مسار كتابة فعلي داخل Dev Guardian، ومقصود أن يكون أضيق من shell agent حر. يستقبل Unified Diff كبيانات، ولا يعطي المزود الخارجي صلاحية مباشرة على المستودع.

قبل الكتابة:

- يجب أن يكون ملف patch خارج working tree.
- يجب أن يكون Event Ledger خارج working tree.
- يفرض حدًا لحجم patch وعدد الملفات.
- يرفض binary patches وsymlinks والـrename/copy والمسارات المقتبسة أو غير المدعومة.
- يشترط working tree نظيفًا تمامًا.
- يتحقق من `HEAD` مقابل base commit في Task Contract.
- يتحقق من المنفذ مقابل Router.
- يمرر كل الملفات إلى Executor Guard قبل أي تطبيق.
- يسجل `patch-preflight` في Live Event Ledger.
- يشغّل `git apply --check --whitespace=error-all` قبل الكتابة الفعلية.

بعد التطبيق:

- يستخدم `git status --porcelain=v1 -z --untracked-files=all` حتى لا تختفي الملفات الجديدة غير المتتبعة عن الحارس.
- يقارن الملفات الفعلية بملفات manifest ولا يقبل ملفًا إضافيًا أو مفقودًا.
- يشغّل Executor Guard مرة ثانية على الحالة الفعلية.
- إذا فشل فحص post-apply ينفذ rollback إلى الشجرة النظيفة (`git reset --hard HEAD` ثم `git clean -fd`) ويسجل حدث rollback.
- إذا أوقف Live Guard الاستمرار بعد التطبيق، يعيد الشجرة النظيفة أيضًا.
- عند النجاح يسجل `patch-applied` فقط، ولا ينفذ commit أو push أو merge أو deploy.

هذا التصميم يجعل الكتابة عملية transactional محدودة بعقد المهمة بدل إعطاء Agent وصول كتابة عام.

## التحقق

- `tests/dev-guardian.test.mjs`: Repo Intelligence والـguards والـrouter.
- `tests/dev-guardian-stage2.test.mjs`: Task Contract، base commit، scope، budget، استقلال المراجع، bounded context وفصل تعليمات الأمان.
- `tests/dev-guardian-stage3.test.mjs`: Event Ledger، كشف التكرار الحي، Executor Guard، Evidence Aggregator وأحكام المراجعة الصريحة.
- `tests/dev-guardian-stage4.test.mjs`: رفض binary/symlink/rename/quoted paths، تطبيق patch داخل النطاق مع ملف جديد، منع out-of-scope، منع المنفذ الخاطئ والـbase القديم، والتحقق من بقاء الشجرة نظيفة عند الرفض.
- `.github/workflows/dev-guardian-verify.yml`: يشغل المراحل الأربع، يفحص syntax للـrunners، ويبني Repo Intelligence snapshot للمستودع الحقيقي.
- `pr-verify` و`pre-launch-gate` يبقيان كما هما ولا يتم تخفيف أي فحص موجود.

## ما لم يتم بعد عمدًا

- لا تعديل على `package.json` بسبب مهمة UI System الموازية.
- لا تشغيل خارجي تلقائي بسبب label أو push أو PR.
- لا AI Tester أو Reviewer يكتب في المستودع.
- لا commit أو push أو merge أو deploy من Developer Bridge.
- لا shell حر أو صلاحيات إنتاج لمزود خارجي.

## المرحلة التالية بعد اعتماد المرحلة الرابعة

1. تمرير أدلة PR checks الفعلية إلى Evidence Aggregator، لا أدلة workflow اليدوي فقط.
2. إضافة Producer محدود يولّد patch كبيانات فقط ثم يمرره إلى Guarded Developer Bridge.
3. تجربة Dev Guardian على مهام منخفضة الخطورة وقياس false blocks/false passes قبل جعله إلزاميًا.
4. بعد إثبات الثبات، جعل Dev Guardian فحصًا مطلوبًا قبل الدمج دون تخفيف `NAVIXA Pre-Launch Gate`.
