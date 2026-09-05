# UI Quality Checklist

استخدم هذا القالب عند تعديل واجهة NAVIXA أو أحد مكوناتها.

## Scope
- [ ] الهدف والمسار الرئيسي واضحان.
- [ ] تم استخدام النظام البصري والمكونات الموجودة بدل إنشاء نظام موازٍ.
- [ ] لم تتم إضافة dependency جديدة للتحسين البصري دون حاجة مثبتة.

## Direction & Responsive
- [ ] العربية RTL سليمة.
- [ ] الإنجليزية LTR سليمة.
- [ ] لا يوجد horizontal overflow غير مقصود.
- [ ] تم فحص عرض ضيق ومتوسط وواسع.

## Components
- [ ] default
- [ ] hover عند انطباقه
- [ ] focus مرئي
- [ ] active/pressed
- [ ] disabled عند انطباقه
- [ ] loading عند انطباقه
- [ ] empty/error/success عند انطباقها
- [ ] touch targets مناسبة على الجوال

## Motion
- [ ] الحركة تخدم feedback أو hierarchy ولا تشتت.
- [ ] prefers-reduced-motion محترم.
- [ ] لا يوجد transition: all.
- [ ] لا يوجد will-change غير مبرر.

## Typography & Data
- [ ] التسلسل البصري واضح.
- [ ] النص الطويل لا يكسر التخطيط.
- [ ] الأرقام المتغيرة تستخدم tabular numerals عند الحاجة.

## Accessibility
- [ ] semantic HTML قبل ARIA.
- [ ] keyboard navigation سليمة.
- [ ] التركيز والـ labels واضحة.
- [ ] الحالة الحرجة لا تعتمد على اللون وحده.

## Verification
- [ ] lint/type checks ذات الصلة نجحت.
- [ ] tests ذات الصلة نجحت.
- [ ] build نجح عند الحاجة.
- [ ] تمت مراجعة diff النهائي.
