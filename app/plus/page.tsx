import type { Metadata } from "next";
import Link from "next/link";
import { ar } from "../content/ar";
import { arCta } from "../content/cta/ar";
import { languageIdentity } from "../content/languages";
import "./plus.css";
import InterestForm from "./InterestForm";
import ReferralCapture from "./ReferralCapture";
import CheckoutPanel from "./CheckoutPanel";

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
  return <main className="plus-page" dir={languageIdentity.ar.direction}><ReferralCapture/>
    <nav className="plus-nav">
      <Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span><b>NAVIXA</b><small>يفهم يومك</small></span></Link>
      <Link href="/" className="plus-back">العودة للرئيسية ←</Link>
    </nav>

    <section className="plus-hero">
      <span className="plus-eyebrow">{ar.plus.eyebrow}</span>
      <h1>{ar.plus.heroFirst}<br/><strong>{ar.plus.heroEmphasis}</strong></h1>
      <p>{ar.plus.heroDescription}</p>
      <div className="plus-hero-actions"><a href="#plans">{arCta.explorePlans}</a><a className="ghost" href="#included">{arCta.whatsIncluded}</a></div>
      <div className="plus-trust"><span>✓ {ar.plus.trialTrust}</span><span>✓ {ar.plus.noChargeTrust}</span><span>✓ {ar.plus.cancellationTrust}</span></div>
      <div className="plus-orbit a"/><div className="plus-orbit b"/><div className="plus-mark"><img src="/navixa-mark.webp" alt=""/></div>
    </section>

    <section className="plus-value" id="included" aria-labelledby="included-title">
      <header><small>{ar.plus.includedEyebrow}</small><h2 id="included-title">{ar.plus.includedTitle}</h2><p>{ar.plus.includedDescription}</p></header>
      <div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>

    <section className="plus-plans" id="plans" aria-labelledby="plans-title">
      <header><small>{ar.plus.plansEyebrow}</small><h2 id="plans-title">{ar.plus.plansTitle}</h2><p>{ar.plus.plansDescription}</p></header>
      <div className="plan-grid">
        <article className="plan-card trial"><span className="plan-tag">ابدأ مجانًا</span><h3>جرّب Plus بهدوء</h3><div className="plan-price"><b>بدون</b><span>بطاقة<br/>ولا التزام</span></div><p>ابدأ التجربة الآن. يمكنك إيقافها في أي وقت، ولن يُخصم أي مبلغ تلقائيًا. تنتهي التجربة في 19 سبتمبر 2026 الساعة 11:59 مساءً بتوقيت أم القرى.</p><Link href="/#account">ابدأ تجربتك المجانية</Link></article>
        <article className="plan-card featured"><span className="plan-tag">عرض المؤسسين · أول 100 عميل</span><h3>Plus الشهري</h3><div className="plan-price"><b>19</b><span>ر.س<br/>شهريًا</span></div><p>لأول 100 اشتراك فقط: خصم مؤسسين محدود، يظهر لك قبل تأكيد الدفع.</p><a href="#checkout">اشترك مباشرة</a></article>
        <article className="plan-card"><span className="plan-tag">قيمة أوفر</span><h3>3 + 1</h3><div className="plan-price"><b>57</b><span>ر.س<br/>لـ 4 أشهر</span></div><p>ادفع 3 أشهر وخذ الشهر الرابع مجانًا عند الإطلاق.</p><a href="#checkout">اختر باقتك</a></article>
      </div>
      <aside className="founders-note"><span>✦</span><p><b>عرض المؤسسين لأول 100 عميل.</b> كود خصم محدود بعدد 100 استخدام، ولا يمكن استخدامه بعد اكتمال العدد.</p></aside>
    </section>

    <CheckoutPanel/>
    <InterestForm/>

    <section className="plus-promise"><div><small>وعد NAVIXA</small><h2>لا نبيع بياناتك لنموذج الاشتراك.</h2><p>الدفع سيكون عبر بوابة خارجية آمنة عند الإطلاق. تفضيلاتك وخصوصيتك المحلية تبقى كما هي.</p></div><Link href="/privacy">اقرأ سياسة الخصوصية ←</Link></section>

    <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt=""/><span><b>NAVIXA</b><small>يفهم يومك</small></span></Link><span>الإطلاق الثاني · التجربة حتى 19 سبتمبر 2026</span></footer>
  </main>;
}
