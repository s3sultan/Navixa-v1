# NAVIXA Security Validation

هذه الطبقة تضيف فحوصًا أمنية دفاعية وتقوية محدودة منخفضة المخاطر فوق بوابات NAVIXA الحالية. أي تعديل Runtime ناتج عن finding يبقى على فرع معزول ولا يصل الإنتاج قبل بوابات التحقق والمراجعة.

## قبل الدمج

`security-code.yml` يشغّل:

- CodeQL على JavaScript/TypeScript باستخدام `security-extended`.
- Trivy على المستودع والإعدادات والأسرار والاعتماديات.
- SARIF إلى GitHub Code Scanning.
- CycloneDX SBOM من Trivy.
- Gate يمنع High/Critical في Trivy، ويمنع CodeQL runtime security-severity >= 7.0.
- التقارير الكاملة لا تُختزل في نتيجة الـgate: كل finding يُراجع ويُسجّل في `security/ALERT_REGISTER.md` حتى لو كان Low أو Informational أو داخل أدوات التطوير/الاختبارات.
- `package-lock.json` يبقى قفل الاعتماديات الفعلي لأن CI والإنتاج يستخدمان `npm ci`. لا تُحذف lockfiles الأخرى عرضًا ضمن مهمة الأمان؛ أي تنظيف اعتماديات له تغيير مستقل.

## الفحص الحي

`security-live.yml` يعمل عند تغييرات منظومة الأمان في PR، وأسبوعيًا، ويدويًا. عند كل push إلى `master` ينتظر نجاح نشر الإنتاج لنفس SHA قبل اعتبار الفحص الحي دليلًا على الإصدار الجديد:

- OWASP ZAP Baseline فقط، وهو passive baseline ولا يشغّل Active Scan.
- Nuclei بفحص High/Critical منخفض المعدل، مع استبعاد `fuzz`, `dos`, `bruteforce`, `intrusive` وتعطيل Interactsh والقوالب غير الموقعة.
- قوالب Nuclei الرسمية تُنزّل صراحة قبل الفحص ثم تُقرأ read-only أثناء التنفيذ.
- ZAP ينتج HTML/JSON/Markdown ويعرض Medium/Low/Informational أيضًا؛ لا تُهمل لأنها لا تفشل الـjob.
- Nuclei ينتج JSONL/SARIF.
- التقارير تُرفع كـGitHub Actions artifacts لمدة 14 يومًا.

## سياسة جميع التنبيهات

- نجاح GitHub Action لا يعني وحده أن كل التنبيهات اختفت.
- كل تنبيه يجب أن ينتهي إلى واحدة من ثلاث حالات فقط: `fixed` أو `accepted-temporarily` بسبب موثّق أو `informational/expected` بعد المراجعة.
- لا يُقبل تنبيه جديد غير مسجل على أنه معروف تلقائيًا.
- إصلاحات الإنتاج التي لا يستطيع PR live scan رؤيتها، مثل هيدرات static assets، تبقى `fixed-pending-deploy` حتى النشر وإعادة الفحص على SHA المنشور.
- لا يتم تشديد CSP/COEP/COOP/CORP فقط لإرضاء الماسح إذا كان التغيير قد يكسر Google login أو الصوت أو CDN؛ يمر أولًا عبر staging واختبار توافق واضح.

## حدود الأمان

- الهدف الثابت للإنتاج: `https://navixasa.com`.
- ZAP Active Scan غير مفعل.
- Nuclei rate limit = 5 requests/sec، concurrency = 5، retries = 1.
- لا credentials أو cookies أو جلسات مستخدمين تدخل الفحص.
- لا اختبارات destructive أو DoS أو brute force.
- أي finding لا يعني اختراقًا مؤكدًا قبل المراجعة اليدوية.
- صلاحيات GitHub Actions تطبق بأقل مستوى مطلوب لكل job، وليست write على مستوى workflow كامل.

## Windows

السكربت `security/windows-navixa-scan.ps1` يشغّل نفس الفحص الحي المقيد محليًا عبر Docker Desktop ويكتب التقارير داخل `navixa-security-reports`. يقوم السكربت أيضًا بتنزيل قوالب Nuclei الرسمية قبل تشغيل الفحص.

مثال من PowerShell داخل المستودع:

```powershell
powershell -ExecutionPolicy Bypass -File .\security\windows-navixa-scan.ps1
```

أو مع هدف آخر مملوك لك:

```powershell
powershell -ExecutionPolicy Bypass -File .\security\windows-navixa-scan.ps1 -Target "https://example.com"
```

## الإصدارات المثبتة عند إنشاء الطبقة

- CodeQL Action v4 resolved to commit `b96794f015dfd88f77b49b1c93e0fa7110f94c63`.
- Trivy `0.74.0`.
- OWASP ZAP `2.17.0`.
- Nuclei `3.11.1`.
- `actions/upload-artifact` pinned to `ea165f8d65b6e75b540449e92b4886f43607fa02`.

ترقية الإصدارات لاحقًا تعامل كتغيير أمني مستقل وتخضع لنفس مراجعة SHA/version والـCI.
