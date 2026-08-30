import type { Metadata } from "next";
import Link from "next/link";
import "../privacy/privacy.css";

export const metadata: Metadata = {
  title: "سياسة التسليم والتنفيذ | NAVIXA",
  description: "طريقة تسليم وتفعيل خدمات NAVIXA الرقمية وحقوق المستخدم عند تعذر التنفيذ.",
  alternates: { canonical: "/delivery" },
};

export default function DeliveryPage() {
  return (
    <main className="privacy-page" dir="rtl">
      <header><Link href="/" className="privacy-back">العودة للرئيسية →</Link><div><small>NAVIXA SA</small><h1>سياسة التسليم والتنفيذ</h1><p>آخر تحديث: أغسطس 2026</p></div></header>
      <section><h2>خدمة رقمية</h2><p>NAVIXA خدمة رقمية، لذلك لا يوجد شحن أو توصيل لمنتج مادي. عند إتاحة الاشتراك المدفوع ونجاح عملية الدفع، يكون التسليم عبر تفعيل الخطة المؤهلة على الحساب المرتبط بالعملية.</p></section>
      <section><h2>بدء الاستفادة</h2><p>يظهر وضع الاشتراك داخل حساب المستخدم بعد تأكيد العملية من مزود الدفع. قد تتطلب بعض المزايا تسجيل الدخول أو منح إذن من الجهاز مثل الميكروفون أو الكاميرا أو الإشعارات.</p></section>
      <section><h2>تعذر التفعيل أو التأخير</h2><p>إذا تم تحصيل مبلغ ولم يظهر الاشتراك أو تعذر الانتفاع بالخدمة، افتح تذكرة من مركز الدعم مع وصف المشكلة من دون إرسال بيانات البطاقة. تُراجع العملية وحالة التفعيل، وتطبق الحقوق النظامية وسياسة الإلغاء والاسترداد بحسب الحالة.</p><p><Link href="/support">فتح مركز الدعم →</Link> · <Link href="/refunds">سياسة الإلغاء والاسترداد →</Link></p></section>
      <section><h2>عدم وجود رسوم شحن</h2><p>لا تفرض NAVIXA رسوم شحن على الاشتراك الرقمي. أي رسوم أو ضرائب واجبة مرتبطة بعملية الشراء يجب أن تظهر للمستخدم قبل تأكيد الدفع متى كانت مطبقة.</p></section>
    </main>
  );
}
