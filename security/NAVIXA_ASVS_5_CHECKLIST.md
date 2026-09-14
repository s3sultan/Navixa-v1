# NAVIXA ASVS 5.0 Adoption Checklist

مرجع هذه القائمة هو OWASP ASVS 5.0.0 المستقر. هذه وثيقة تتبع داخلية وليست ادعاء امتثال كامل لـ ASVS.

## طريقة الاستخدام

- `verified`: يوجد دليل اختبار أو فحص واضح ومراجع.
- `partial`: توجد حماية أو اختبارات، لكن التغطية ليست كاملة وفق ASVS.
- `pending`: لم يثبت التحقق بعد.
- `n/a`: غير منطبق على NAVIXA مع سبب موثق.

لا يتم تغيير حالة أي بند إلى `verified` بسبب نجاح ماسح واحد فقط. يجب وجود دليل مناسب للكود أو الاختبار أو الإعداد التشغيلي.

| المجال | مرجع ASVS | الحالة الحالية | الدليل الحالي في NAVIXA | المطلوب قبل verified |
|---|---|---|---|---|
| الترميز، التعقيم ومنع الحقن | V1 | partial | CodeQL security-extended + اختبارات API | مراجعة متطلبات L1 المنطبقة وتوثيق الدليل |
| التحقق ومنطق الأعمال | V2 | partial | اختبارات API والدفع والحدود التشغيلية | ربط قواعد التحقق الحرجة باختبارات سلبية وحدية |
| أمان واجهة الويب | V3 | partial | ZAP passive + اختبارات SEO/security baseline | مراجعة CSP والـ browser controls وإثبات عدم كسر Google login والصوت |
| API وخدمات الويب | V4 | partial | `tests/api-security.test.ts` + rate-limit tests | جرد endpoints والتحقق من methods/content-types/CORS والحدود |
| رفع/معالجة الملفات | V5 | pending | لا يوجد ادعاء تغطية شامل | جرد كل نقاط رفع/تحليل الملفات وتطبيق القيود المطلوبة |
| المصادقة | ASVS authentication controls | partial | admin/local auth + OTP + rate-limit tests | مراجعة دورة الدخول والاسترداد والتعطيل ومحاولات الإساءة |
| الجلسات والرموز | ASVS session/token controls | partial | remembered-login + device-control tests | مراجعة expiry/revocation/rotation/cookie attributes |
| الصلاحيات والتحكم بالوصول | ASVS access-control controls | partial | access model + admin/device tests | اختبار deny-by-default وIDOR لكل مورد حساس |
| OAuth/OIDC وتسجيل Google | ASVS OAuth/OIDC controls | partial | تدفق Google الحالي + اختبارات auth | مراجعة state/nonce/redirect URIs/token handling على staging |
| التشفير وTLS | ASVS cryptography/communications controls | partial | HTTPS production + فحوص live security | مراجعة TLS والمواد السرية ومواقع التخزين وعدم وجود crypto مخصص غير لازم |
| الإعدادات والأسرار والاعتماديات | ASVS configuration controls | verified | Trivy vuln/misconfig/secret + Gitleaks + npm audit + SBOM | يستمر التحقق الدوري وتراجع الحالة عند ظهور finding غير مغلق |
| حماية البيانات والخصوصية | ASVS data-protection controls | partial | سياسات المشروع + نمط التخزين المحلي لبعض الميزات | جرد البيانات، retention، الحذف، الوصول، السجلات والنسخ الاحتياطية |
| التسجيل والأخطاء والمراقبة | ASVS logging/error controls | partial | admin activity log + CI security reports | التأكد من عدم تسجيل أسرار/رموز وإضافة قواعد تنبيه للحالات الحرجة |
| سلامة البناء وسلسلة التوريد | ASVS secure-development controls | verified | pinned GitHub Actions + zizmor + lockfile + pre-launch gate | إبقاء الترقيات كتغييرات مستقلة ومراجعة |

## فحوص NAVIXA المرتبطة

- `security-code.yml`: CodeQL + Trivy + SBOM.
- `security-live.yml`: ZAP passive + Nuclei المقيد.
- `pre-launch-gate.yml`: build/tests/npm audit/zizmor/Gitleaks.
- `readiness-audit.yml`: Lighthouse CI + MDN HTTP Observatory.

## قواعد أمان التطبيق

1. لا نشغّل ZAP Active Scan على الإنتاج.
2. لا نشغّل فحوص DoS أو brute force أو intrusive على الإنتاج.
3. Lighthouse وHTTP Observatory فحوص قراءة فقط ولا تعدّل الموقع.
4. لا نغيّر CSP أو headers لمجرد رفع الدرجة قبل اختبار Google login والصوت والميزات الحساسة على staging.
5. أي إصلاح runtime يمر عبر فرع/PR والبوابات الحالية قبل الإنتاج.

## خط الأساس

- المعيار: OWASP ASVS 5.0.0 stable.
- الهدف الأول: تغطية متطلبات Level 1 المنطبقة على NAVIXA ثم رفع المجالات الحساسة تدريجيًا.
- لا تُستخدم نسخة `master` المتغيرة من ASVS كمرجع امتثال؛ التحديث إلى إصدار مستقر جديد يكون تغييرًا مستقلاً.
