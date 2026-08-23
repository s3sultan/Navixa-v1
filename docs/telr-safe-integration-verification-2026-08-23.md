# تحقق دمج Telr الآمن — NAVIXA SA

**التاريخ:** 23 أغسطس 2026، بتوقيت السعودية.

| الفحص | النتيجة |
|---|---|
| محول Telr | أضيف في طبقة المحولات مع حالة معطّلة افتراضيًا. |
| أسرار مطلوبة فقط بالاسم | `TELR_STORE_ID` و`TELR_TEST_AUTH_KEY` أو`TELR_LIVE_AUTH_KEY` و`TELR_WEBHOOK_SECRET`. لم تُضف أي قيمة. |
| إنشاء جلسة Telr | مهيأ منطقيًا لـHosted Payment Page؛ يرفض البناء عند غياب التفعيل أو الأسرار. |
| قيمة الريال | يحوّل قيمة NAVIXA المخزنة بالهللات إلى صيغة Telr بالوحدات الرئيسية: 1900 → `19.00` ر.س. |
| الاختبارات | `npm test` نجح: 46/46. |
| الفحص والبناء | `npm run lint` و`npm run build` نجحا. |
| صفحة Plus المحلية | بقيت مغلقة للزوار وتعرض «الاشتراك المدفوع يفتح قريبًا». لا يظهر Telr ولا تُنشأ جلسة دفع. |

> لم يُشغّل تحصيل حي، ولم تُدخل مفاتيح، ولم تُنشأ جلسة Telr، ولم تتغير إعدادات الإنتاج.

## متطلبات المرحلة التالية

1. حساب تاجر Telr مع رخصة/سجل تجاري وموافقة الحساب.
2. قبول عرض Entry أو عرض مكتوب بديل، بما يشمل VAT ورسوم البنك.
3. إضافة أسرار Sandbox في Cloudflare مباشرة دون مشاركتها في المحادثة أو Git.
4. تحديد مسار Webhook الرسمي وإكمال تحقق SHA1 وإعادة التحقق عبر `order.json`.
5. اختبار حالات النجاح والرفض والإلغاء وتكرار Webhook وعدم تطابق المبلغ/العملة.
6. اختبار حي محدود مفوض، ثم تأكيد منفصل قبل إظهار الدفع للزوار.

## مراجع

[1]: https://telr.com/sa-en/pricing "Telr Saudi Arabia Pricing"
[2]: https://docs.telr.com/reference/payment-page "Telr Hosted Payment Page — Create Session"
[3]: https://docs.telr.com/reference/check-status-1 "Telr Hosted Payment Page — Check Status"
[4]: https://docs.telr.com/reference/webhook "Telr Webhook"
