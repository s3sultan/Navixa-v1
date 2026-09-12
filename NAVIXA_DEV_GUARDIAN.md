# NAVIXA Dev Guardian

هذه الطبقة تطوّر منظومة الوكلاء الحالية داخل NAVIXA بدل استبدالها أو إدخال إطار تشغيل خارجي كامل. الهدف هو إضافة فهم آلي للمستودع، توجيه قابل للتدقيق، وحدود توقف واضحة فوق بروتوكولات NAVIXA الحالية وGitHub Actions الموجودة أصلًا.

## مبادئ ثابتة

- GitHub و`master` يبقيان المصدر الرسمي.
- لا وكيل يدمج أو ينشر بنفسه.
- لا أسرار أو صلاحيات إنتاج داخل Dev Guardian.
- كل تغيير كتابي يظل في branch/PR معزولًا حتى اجتياز فحوص NAVIXA الحالية.
- Dev Guardian لا يستبدل `pr-verify` أو `pre-launch-gate`؛ يعمل قبلهما وفوقهما.
- أي مخرجات ذكاء خارجي تعامل كمادة غير موثوقة حتى تمر بالمراجعة والفحوص.
- التخطيط المحلي لا يشغّل أي مزود خارجي. Gemini/Manus يحتاجان موافقة يدوية صريحة مستقلة، ولا تُجرى مكالمات خارجية لمجرد فتح PR أو دفع commit.

## خط التنفيذ المستهدف

```text
NAVIXA Repo Intelligence
        ↓
NAVIXA Task Contract
        ↓
NAVIXA Planner + Agent Router
        ↓
Developer Agent
        ↓
Existing NAVIXA Tests
        ↓
AI Tester (read-only)
        ↓
Independent Reviewer (+ security when required)
        ↓
NAVIXA Pre-Launch Gate
        ↓
Merge
```

ويحيط بالمسار كاملًا:

```text
Scope Guard + Budget Guard + Stuck Detector
```

## المرحلة الأولى: الأساس

### Repo Intelligence

الملف: `scripts/dev-guardian/repo-intelligence.mjs`

يبني snapshot بنيويًا من المستودع دون أي اتصال خارجي أو اعتماديات جديدة، ويستخرج الصفحات وAPI routes وworkflows وmigrations وdependency/reverse-dependency graph وروابط الاختبارات وhotspots والاعتماديات المرصودة.

أمثلة تشغيل:

```bash
node scripts/dev-guardian/repo-intelligence.mjs --root . --check
node scripts/dev-guardian/repo-intelligence.mjs --root . --json
```

### Scope / Budget / Stuck Guards

الملف: `scripts/dev-guardian/guards.mjs`

- Scope Guard يطبق allow/deny patterns ويرفض path traversal والمسارات المطلقة والمسارات الحساسة الافتراضية مثل `.env` والمفاتيح.
- Budget Guard يفرض حدود `maxSteps`, `maxCostUsd`, `maxTokens`, `maxWallMs`.
- Stuck Detector يكشف تكرار نفس الفعل/الخطأ، سلسلة الفشل، oscillation، وثبات progress hash دون تقدم.

### Agent Router

الملف: `scripts/dev-guardian/router.mjs`

Router حتمي وقابل للمراجعة يعتمد على مستوى الخطورة، الحاجة للكتابة، حساسية الأمان، UI، التكاملات الخارجية وحجم التغيير. ويعيد الوكيل الأساسي والمراجعين والفحوص وبوابات الاعتماد وحدود التشغيل.

## المرحلة الثانية: Task Contract والربط الفعلي

### Task Contract

الملف: `scripts/dev-guardian/task-contract.mjs`

يحوّل نموذج GitHub Issue المعتمد إلى عقد موحد يتضمن:

- الهدف.
- معايير القبول.
- مستوى الخطورة.
- الوكيل المقترح.
- base commit الفعلي والمطلوب.
- allowed/forbidden scope.
- الميزانية والمهلة.
- إشارات حساسية الأمان/UI/التكاملات.
- ملفات context مختارة من Repo Intelligence.

إذا غاب الهدف أو معايير القبول أو النطاق المسموح أو base commit تتوقف المهمة بدل التخمين. إذا طلبت المهمة commit صريحًا لا يطابق snapshot الجاري، تتوقف بـ`base-commit-mismatch`. كما أن اختيار context يخضع لنفس allowed/forbidden scope منذ مرحلة التخطيط، فلا تتوسع الخريطة خارج النطاق المعتمد.

### Guardian Planner

الملف: `scripts/dev-guardian/guardian-task-runner.mjs`

يقرأ Issue المفتوح، يبني Repo Intelligence، ينشئ العقد، يشغّل Router وReview Dispatch، يطبق الحد الأكثر تشددًا بين سياسة Router وميزانية المهمة، ثم يكتب Plan JSON ويعلّق ملخصًا قابلًا للتدقيق على Issue.

هذه الخطوة **لا تستدعي أي ذكاء خارجي**.

### Independent Review Dispatch

الملف: `scripts/dev-guardian/review-dispatch.mjs`

- يضمن أن المراجع الخارجي ليس نفس المنفذ.
- يستخدم Gemini كـAI Tester قراءة فقط عندما تكون هناك مهمة تنفيذية.
- يستخدم Manus كمراجع مستقل قراءة فقط.
- إذا كانت المهمة أمنية، تُدمج مراجعة التهديدات في مهمة المراجع المستقل بدل تشغيل استدعاء خارجي ثالث مكرر.
- تبقى مراجعات Router الأخرى مثل Claude Code مسجلة، لكنها لا تعامل كـBridge قابل للاستدعاء ما لم يكن لها ربط فعلي معتمد.

### External Review Bridge

الملف: `scripts/dev-guardian/external-review-runner.mjs`

يربط الخطة المحكومة مع Gemini أو Manus وفق الدور المعتمد فقط. قبل إرسال أي context:

- يتحقق أن المزود/الدور موجود فعلًا في Plan.
- يمنع reviewer/executor collision.
- يطبق Scope Guard.
- يمنع `.env`, private keys والمسارات الحساسة.
- يرفض symlinks والمسارات الخارجة عن جذر المستودع.
- يحد حجم كل ملف وإجمالي context.
- يعامل الكود والنص كمدخل غير موثوق.
- النتيجة تقرير مراجعة فقط ولا تطبق أو تدمج أو تنشر.

مع Gemini توضع قواعد الدور والأمان في `system_instruction` منفصلة عن task/context غير الموثوق، ويُطلب صراحة تجاهل أي تعليمات مضمنة داخل الكود أو التعليقات أو التوثيق تحاول تغيير الدور أو كشف البيانات أو إضعاف الحدود. مع Manus تُسبق البيانات غير الموثوقة بنفس قواعد الأمان الثابتة داخل الرسالة المقيدة.

### Workflow اليدوي

`.github/workflows/dev-guardian-task.yml`

مدخلاته:

- `issue_number`
- `approved`
- `dispatch_external`

`approved=true` يسمح ببناء الخطة فقط. ولا يتم استدعاء Gemini/Manus إلا عندما يكون `dispatch_external=true` أيضًا، ويجب أن يكون المشغل مالك المستودع. هذا الفصل مقصود حتى يمكن استخدام التخطيط والعقد والـRouter دون تكلفة خارجية أو إرسال context إلى طرف خارجي.

## التحقق

- `tests/dev-guardian.test.mjs`: Repo Intelligence والـguards والـrouter.
- `tests/dev-guardian-stage2.test.mjs`: Task Contract، ربط base commit، منع توسيع context خارج scope، الميزانية، استقلال المراجع، bounded context، منع الأسرار، فصل system safety عن البيانات غير الموثوقة، وخطة المرحلة الثانية.
- `.github/workflows/dev-guardian-verify.yml`: يشغل المجموعتين، يفحص syntax للـrunners ويبني Repo Intelligence snapshot للمستودع الحقيقي.
- `pr-verify` و`pre-launch-gate` يبقيان كما هما ولا يتم تخفيف أي فحص موجود.

المرحلة الثانية اجتازت على PR #194 قبل تحديث هذا السجل: `NAVIXA Dev Guardian Verify` #19، و`Verify NAVIXA Pull Request` #476، و`NAVIXA Pre-Launch Gate` #366 مع Release Gate، شاملة فحص GitHub Actions والأسرار وتدقيق اعتماديات الإنتاج وlint والاختبارات وUI smoke وبناء الإنتاج. تحديث هذا السجل توثيقي فقط ولا يغيّر منطق Dev Guardian.

## ما لم يتم بعد عمدًا

- لا تعديل على `package.json` بسبب مهمة UI System الموازية.
- لا تشغيل خارجي تلقائي بسبب label أو push أو PR.
- لا AI Tester أو Reviewer يكتب في المستودع.
- لا دمج أو نشر إنتاجي من Dev Guardian.
- لا يصبح Dev Guardian بوابة merge إلزامية حتى يثبت عبر PR والمراجعة المستقلة.

## المرحلة التالية بعد اعتماد المرحلة الثانية

1. إضافة سجل أحداث موحد للتنفيذ الحي كي يطبق Stuck Detector بين الوكلاء وليس في الاختبارات فقط.
2. إضافة Evidence Aggregator يجمع نتيجة الاختبارات وAI Tester والمراجع المستقل في حكم واحد قابل للتدقيق.
3. ربط منفذ التطوير الفعلي بعقد المهمة بحيث لا يستطيع تعديل ملف خارج scope.
4. بعد إثبات الثبات، جعل Dev Guardian فحصًا مطلوبًا قبل الدمج دون تخفيف Pre-Launch Gate.
