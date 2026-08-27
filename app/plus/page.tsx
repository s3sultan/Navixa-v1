import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import "./plus.css";
import "./plus-simple.css";
import InterestForm from "./InterestForm";
import ReferralCapture from "./ReferralCapture";

export const metadata: Metadata = {
  title: "NAVIXA Plus — مزايا أوسع عندما تتاح رسميًا",
  description: "تعرف على القيمة الإضافية في NAVIXA Plus وسجل اهتمامك بالتجارب القادمة، دون دفع أو طلب بطاقة حاليًا.",
};

const included = [
  ["◉", "سماع نداء الاسم", "تنبيه محلي اختياري لأسماء وكلمات تهمك بعد موافقتك."],
  ["▣", "متابعة الشاشة", "متابعة محلية لما تختاره في الشاشة، من دون إرسال محتواها."],
  ["⌁", "استمرارية بين الأجهزة", "خيارات إضافية للاستخدام المنظم عند تفعيلها لحسابك."],
];

export default function NavixaPlusPage() {
  return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
    <ReferralCapture />
    <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/" className="plus-back">العودة للرئيسية ←</Link></nav>

    <section className="plus-hero" aria-labelledby="plus-title"><span className="plus-eyebrow">NAVIXA Plus</span><h1 id="plus-title">مزايا أوسع،<br /><strong>عندما تحتاجها.</strong></h1><p>Plus امتداد اختياري لتجربة NAVIXA. نعرض القيمة بوضوح، ونبقي التفعيل والدفع خارج الصفحة إلى أن تكتمل بوابة دفع رسمية وآمنة.</p><div className="plus-hero-actions"><a href="#included">ما الذي تضيفه Plus؟</a><a className="ghost" href="#interest">سجّل اهتمامك</a></div><div className="plus-trust"><span>✓ لا يوجد دفع حاليًا</span><span>✓ لا نطلب بطاقة</span><span>✓ الخصوصية أولًا</span></div><div className="plus-mark"><img src="/navixa-mark.webp" alt="" /></div></section>

    <section className="plus-value" id="included" aria-labelledby="included-title"><header><small>القيمة الإضافية</small><h2 id="included-title">أدوات مفيدة، عند اختيارك لها</h2><p>لا تعمل ميزات الجهاز إلا بعد موافقة صريحة منك، ويمكنك متابعة الأساسيات في NAVIXA دون Plus.</p></header><div className="plus-feature-grid">{included.map(([icon, title, description]) => <article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>

    <section className="plus-status" aria-labelledby="plus-status-title"><div><span className="plus-status-icon">i</span><div><small>الحالة الحالية</small><h2 id="plus-status-title">التفعيل العام غير متاح الآن</h2><p>لا يوجد زر شراء أو تحويل خارجي في هذه الصفحة. إذا مُنح حسابك تجربة أو وصولًا إداريًا، ستظهر حالته داخل حسابك.</p></div></div><Link href="/account">إدارة حسابك ←</Link></section>

    <InterestForm />

    <section className="plus-promise"><div><small>وعد NAVIXA</small><h2>بياناتك ليست ثمن الاشتراك.</h2><p>لن تحفظ NAVIXA بيانات بطاقات أو محافظ. وعند إتاحة الدفع رسميًا سيكون عبر مزود معتمد وتحقيق خادمي آمن.</p></div><Link href="/privacy">اقرأ سياسة الخصوصية ←</Link></section>
    <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span>NAVIXA Plus · تُعلن حالة التفعيل عند جاهزيتها</span></footer>
  </main>;
}
