import type { Metadata } from "next";
import Link from "next/link";
import "../privacy/privacy.css";

export const metadata: Metadata = {
  title: "سياسة الشكاوى والمقترحات | NAVIXA",
  description: "آلية تقديم ومتابعة الشكاوى والمقترحات المتعلقة بخدمات NAVIXA.",
  alternates: { canonical: "/complaints" },
};

export default function ComplaintsPage() {
  return (
    <main className="privacy-page" dir="rtl">
      <header><Link href="/" className="privacy-back">← العودة للرئيسية</Link><div><small>NAVIXA SA</small><h1>سياسة الشكاوى والمقترحات</h1><p>آخر تحديث: أغسطس 2026</p></div></header>
      <section><h2>تقديم الشكوى أو المقترح</h2><p>يمكن للمستخدم تقديم شكوى أو مقترح من مركز الدعم الرسمي. اختر التصنيف المناسب واكتب وصفًا واضحًا للمشكلة أو المقترح، من دون مشاركة كلمة المرور أو رمز OTP أو بيانات البطاقة.</p><p><Link href="/support">فتح مركز الدعم ←</Link></p></section>
      <section><h2>المتابعة</h2><p>تُسجل التذكرة داخل حساب المستخدم ويمكن متابعة حالتها ورد الدعم من مركز الدعم. قد نطلب معلومات إضافية لازمة للتحقق من المشكلة أو العملية محل الشكوى.</p></section>
      <section><h2>الشكاوى المالية</h2><p>تُراجع الشكاوى المتعلقة بالفواتير أو الخصم أو الاسترداد وفق بيانات العملية وسياسة الإلغاء والاسترداد المنشورة، وبما لا ينتقص من الحقوق الإلزامية للمستهلك.</p><p><Link href="/refunds">سياسة الإلغاء والاسترداد ←</Link></p></section>
      <section><h2>المقترحات</h2><p>نرحب بالمقترحات لتحسين NAVIXA. تقديم المقترح لا يعني الالتزام بتنفيذه أو بموعد محدد، وقد يُستخدم لتحسين الخدمة من دون نشر بيانات صاحب المقترح.</p></section>
      <section><h2>الخصوصية</h2><p>تعالج بيانات التذاكر بالقدر اللازم للدعم والمتابعة وفق سياسة الخصوصية. لا ترسل معلومات حساسة لا تحتاجها معالجة الطلب.</p><p><Link href="/privacy">سياسة الخصوصية ←</Link></p></section>
    </main>
  );
}
