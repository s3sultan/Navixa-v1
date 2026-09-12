# NAVIXA Security Validation

هذه الطبقة تضيف فحوصًا أمنية دفاعية فوق بوابات NAVIXA الحالية، دون تغيير Runtime المنتج.

## قبل الدمج

`security-code.yml` يشغّل:

- CodeQL على JavaScript/TypeScript باستخدام `security-extended`.
- Trivy على المستودع والإعدادات والأسرار والاعتماديات.
- SARIF إلى GitHub Code Scanning.
- CycloneDX SBOM من Trivy.
- Gate يفشل عند High/Critical في Trivy، وعند CodeQL security-severity >= 7.0.

## بعد نشر الإنتاج

`security-live.yml` يعمل بعد نجاح `Deploy NAVIXA Auto`، أسبوعيًا، أو يدويًا:

- OWASP ZAP Baseline فقط، وهو passive baseline ولا يشغّل Active Scan.
- Nuclei بفحص High/Critical منخفض المعدل، مع استبعاد `fuzz`, `dos`, `bruteforce`, `intrusive` وتعطيل Interactsh والقوالب غير الموقعة.
- ZAP ينتج HTML/JSON/Markdown.
- Nuclei ينتج JSONL/SARIF.
- التقارير تُرفع كـGitHub Actions artifacts لمدة 14 يومًا.

## حدود الأمان

- الهدف الثابت للإنتاج: `https://navixasa.com`.
- ZAP Active Scan غير مفعل.
- Nuclei rate limit = 5 requests/sec، concurrency = 5، retries = 1.
- لا credentials أو cookies أو جلسات مستخدمين تدخل الفحص.
- لا اختبارات destructive أو DoS أو brute force.
- أي finding لا يعني اختراقًا مؤكدًا قبل المراجعة اليدوية.

## Windows

السكربت `security/windows-navixa-scan.ps1` يشغّل نفس الفحص الحي المقيد محليًا عبر Docker Desktop ويكتب التقارير داخل `navixa-security-reports`.

مثال من PowerShell داخل المستودع:

```powershell
powershell -ExecutionPolicy Bypass -File .\security\windows-navixa-scan.ps1
```

أو مع هدف آخر مملوك لك:

```powershell
powershell -ExecutionPolicy Bypass -File .\security\windows-navixa-scan.ps1 -Target "https://example.com"
```

## الإصدارات المثبتة عند إنشاء الطبقة

- CodeQL Action v3 resolved to commit `faaca9a8f6edddba5725ffe5adefdab6669a2eca`.
- Trivy `0.74.0`.
- OWASP ZAP `2.17.0`.
- Nuclei `3.11.1`.
- `actions/upload-artifact` pinned to `ea165f8d65b6e75b540449e92b4886f43607fa02`.

ترقية الإصدارات لاحقًا تعامل كتغيير أمني مستقل وتخضع لنفس مراجعة SHA/version والـCI.
