# NAVIXA Security Alert Register

آخر تحديث: 2026-09-12

القاعدة: لا يُترك أي تنبيه من CodeQL أو Trivy أو OWASP ZAP أو Nuclei بلا تصنيف. كل نتيجة يجب أن تكون `fixed` أو `accepted-temporarily` بسبب موثّق أو `informational/expected`. القبول المؤقت ليس إغلاقًا دائمًا؛ يعاد تقييمه بعد تغييرات CSP أو المصادقة أو موارد الطرف الثالث.

## CodeQL

| النتيجة السابقة | الحالة | المعالجة |
|---|---|---|
| OTP modulo bias | fixed | استبدال `% 1_000_000` بتوليد ست خانات من Web Crypto مع rejection للخانات غير الرقمية. |
| Dedicated Worker message origin | fixed | فحص origin عند توفره + تحقق صارم من نوع الرسالة وFloat32Array والموديل واللغة. |
| 15 تنبيه URL/regex/sanitization داخل الاختبارات | fixed | استبدال فحوص URL/النصوص الهشة بمقارنات host/string دقيقة. |
| 3 file-system race في أدوات التطوير | fixed | القراءة أصبحت عبر file handles مع `O_NOFOLLOW` عند توفره ثم `stat/readFile` على نفس المقبض. |

الحكم النهائي يعتمد على إعادة CodeQL للـhead النهائي؛ لا يعتبر السجل إثباتًا قبل نجاح الفحص.

## Trivy

آخر تقرير مقروء: لا High/Critical vulnerabilities أو misconfigurations أو secrets. يبقى SBOM محفوظًا كـArtifact. أي نتيجة جديدة مهما كانت الدرجة تدخل هذا السجل في الدورة التالية.

## Nuclei

آخر تقرير مقروء: صفر High/Critical ضمن الفحص المقيد غير المدمر. القوالب destructive/fuzz/DoS/bruteforce/intrusive وInteractsh غير مستخدمة.

## OWASP ZAP passive baseline

| التنبيه | الدرجة | الحالة | القرار |
|---|---:|---|---|
| CSP wildcard/default coverage | Medium | accepted-temporarily | الـCSP المفروض حاليًا يقفل `base-uri`, `object-src`, `frame-ancestors`, `form-action`, `manifest-src`, وinline event handlers. تعميم `default-src 'self'` قبل إنهاء جرد الموارد قد يكسر تسجيل Google وموارد الصوت/CDN. النقل إلى nonce صار له مسار staging مخصص. |
| `script-src unsafe-inline` | Medium | accepted-temporarily | `unsafe-inline` موجود في سياسة Report-Only للتوافق والقياس، وليس ترخيصًا صامتًا لإلغاء بقية CSP. يزال بعد نجاح تجربة nonce على staging لكل المسارات الأساسية. |
| `style-src unsafe-inline` | Medium | accepted-temporarily | إزالة inline styles مباشرة قد تكسر Google Identity وبعض مخرجات الإطار؛ يوجد اختبار staging يفصل استثناء Google ويختبر nonce لبقية الصفحات. |
| Cross-Origin-Embedder-Policy missing | Low | accepted-temporarily | `require-corp` قد يمنع موارد Google/CDN/النماذج قبل اكتمال جرد CORS/CORP؛ لا يفرض مباشرة على الإنتاج. |
| Cross-Origin-Opener-Policy missing | Low | accepted-temporarily | `same-origin` قد يؤثر في تدفق Google popup؛ يختبر مع المصادقة قبل التفعيل. |
| Cross-Origin-Resource-Policy missing | Low | accepted-temporarily | يختبر مع الأصول العامة والمسارات الفرعية قبل فرض `same-origin` أو `same-site`. |
| Permissions-Policy missing على `/assets/*` | Low | fixed-pending-deploy | أضيف `public/_headers` بنفس baseline الـWorker. يلزم نشر الـmaster النهائي ثم إعادة ZAP لأن فحص PR يستهدف الإنتاج الحالي. |
| HSTS missing على `/assets/*` | Low | fixed-pending-deploy | أضيف `Strict-Transport-Security: max-age=31536000` للأصول الثابتة. |
| `X-Content-Type-Options` missing على `/assets/*` | Low | fixed-pending-deploy | أضيف `nosniff` للأصول الثابتة. |
| CSP Report-Only header found | Informational | expected | مقصود كقناة قياس قبل نقل script/style policy إلى enforcement؛ لا يزال هناك CSP مفروض منفصل. |
| Modern Web Application | Informational | expected | تعريف تقني من ZAP وليس ثغرة. |
| `/admin` non-storable | Informational | expected | محتوى إداري لا نريد تخزينه في shared caches. |
| Re-examine Cache-Control | Informational | reviewed | الكاش العام محصور في allowlist لمسارات عامة، ويستبعد الطلبات ذات Cookie وRSC/query string. |
| Retrieved from Cache | Informational | reviewed | متوقع للمستندات العامة غير الشخصية فقط. |
| Storable and Cacheable Content | Informational | reviewed | مسارات عامة فقط؛ لا تُخزن استجابة تحمل `Set-Cookie` أو طلبًا شخصيًا. |
| Storable but Non-Cacheable Content | Informational | reviewed | مناسب للأصول/robots/sitemap التي تحتاج revalidation حسب السياسة الحالية. |

## شروط الإقفال

1. إعادة CodeQL بعد كل إصلاح والتأكد من عدم بقاء finding غير مصنف.
2. إعادة ZAP بعد نشر الإصلاحات التي تخص الإنتاج، لأن PR scan لا يستطيع رؤية هيدرات فرع غير منشور.
3. لا نفعّل COEP/COOP/CORP أو CSP أكثر تشددًا في الإنتاج لمجرد إسكات ماسح؛ يجب أن ينجح اختبار staging للمصادقة والصوت والموارد الخارجية أولًا.
4. أي تنبيه جديد غير موجود هنا يعامل كغير مُراجع ويمنع إعلان المهمة "نظيفة" حتى يُفرز.
