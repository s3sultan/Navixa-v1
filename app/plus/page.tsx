import type { Metadata } from "next";
import Link from "next/link";
import "./plus.css";
import InterestForm from "./InterestForm";

export const metadata: Metadata = {
  title: "NAVIXA Plus — يفهم يومك بعمق أكبر",
  description: "خطط NAVIXA Plus التجريبية: مساعد أذكى، تخصيص أوسع، وتجربة خاصة تحترم خصوصيتك.",
};

const included = [
  ["✦", "المساعد الذكي Plus", "ردود أعمق، محادثات أطول، وتنظيم أفكارك بأسلوبك."],
  ["◉", "سماع نداء الاسم", "متابعة كلماتك وأسمائك المهمة محليًا بعد موافقتك."],
  ["▣", "متابعة الشاشة", "تنبيهات محلية لما يهمك في الشاشة أو المنطقة التي تحددها."],
  ["⚽", "تنبيهات مباريات متقدمة", "أكثر من توقيت لفريقك، مع عدّاد واضح قبل البداية."],
  ["⌁", "مزامنة مشفّرة", "استمرارية اختيارية بين أجهزتك مع بقاء بياناتك محمية."],
  ["◐", "مظهر أكثر تخصيصًا", "ألوان وطرق عرض أوسع لتجربة تناسبك."],
];

export default function NavixaPlusPage() {
  return <main className="plus-page" dir="rtl">
    <nav className="plus-nav">
      <Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span><b>NAVIXA</b><small>يفهم يومك</small></span></Link>
      <Link href="/" className="plus-back">العودة للرئيسية ←</Link>
    </nav>

    <section className="plus-hero">
      <span className="plus-eyebrow">NAVIXA PLUS · قريبًا</span>
      <h1>يومك نفسه،<br/><strong>لكن بعمق أكبر.</strong></h1>
      <p>Plus هي الطبقة الاختيارية لمن يريد من NAVIXA مساعدًا أذكى وتخصيصًا أوسع، من دون المساس بالأساسيات اليومية المجانية.</p>
      <div className="plus-hero-actions"><a href="#plans">استكشف الباقات</a><a className="ghost" href="#included">ماذا يتضمن؟</a></div>
      <div className="plus-trust"><span>✓ تجربة 14 يومًا بلا بطاقة</span><span>✓ لا تحصيل مالي الآن</span><span>✓ إلغاء واضح عند الإطلاق</span></div>
      <div className="plus-orbit a"/><div className="plus-orbit b"/><div className="plus-mark"><img src="/navixa-mark.webp" alt=""/></div>
    </section>

    <section className="plus-value" id="included" aria-labelledby="included-title">
      <header><small>مصمم لمن يريد المزيد</small><h2 id="included-title">ماذا ستحصل عليه في Plus؟</h2><p>الأدوات اليومية الأساسية تبقى متاحة للجميع. Plus يمنحك راحة أكثر وذكاء أعمق.</p></header>
      <div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>

    <section className="plus-plans" id="plans" aria-labelledby="plans-title">
      <header><small>خطط الإطلاق المقترحة</small><h2 id="plans-title">اختر ما يناسبك لاحقًا</h2><p>هذه باقات تعريفية في النسخة التجريبية. لن يتم طلب دفع أو بطاقة الآن.</p></header>
      <div className="plan-grid">
        <article className="plan-card trial"><span className="plan-tag">ابدأ هنا</span><h3>تجربة Plus</h3><div className="plan-price"><b>14</b><span>يومًا<br/>بلا بطاقة</span></div><p>تعرف على المساعد الأذكى وميزات Plus قبل أي قرار.</p><a href="#interest">أرغب في التجربة</a></article>
        <article className="plan-card featured"><span className="plan-tag">الأقرب للإطلاق</span><h3>Plus الشهري</h3><div className="plan-price"><b>19</b><span>ر.س<br/>شهريًا</span></div><p>للشخص الذي يريد ذكاءً أعمق وتخصيصًا مستمرًا.</p><a href="#interest">سجّل اهتمامك</a></article>
        <article className="plan-card"><span className="plan-tag">قيمة أوفر</span><h3>3 + 1</h3><div className="plan-price"><b>57</b><span>ر.س<br/>لـ 4 أشهر</span></div><p>ادفع 3 أشهر وخذ الشهر الرابع مجانًا عند الإطلاق.</p><a href="#interest">سجّل اهتمامك</a></article>
      </div>
      <aside className="founders-note"><span>✦</span><p><b>سعر المؤسسين قادم.</b> أوائل المستخدمين سيحصلون على عرض خاص لفترة محدودة عند فتح الاشتراك.</p></aside>
    </section>

    <InterestForm/>

    <section className="plus-promise"><div><small>وعد NAVIXA</small><h2>لا نبيع بياناتك لنموذج الاشتراك.</h2><p>الدفع سيكون عبر بوابة خارجية آمنة عند الإطلاق. تفضيلاتك وخصوصيتك المحلية تبقى كما هي.</p></div><Link href="/privacy">اقرأ سياسة الخصوصية ←</Link></section>

    <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt=""/><span><b>NAVIXA</b><small>يفهم يومك</small></span></Link><span>نسخة تعريفية · لا يوجد تحصيل مالي الآن</span></footer>
  </main>;
}
