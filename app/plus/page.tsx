import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import "./plus.css";
import "./plus-simple.css";
import InterestForm from "./InterestForm";
import ReferralCapture from "./ReferralCapture";

export const metadata: Metadata = {
  title: "NAVIXA Plus — يومك أهدأ وأذكى",
  description: "اكتشف NAVIXA Plus: أدوات إضافية لسماع الاسم، متابعة الشاشة، الاستمرارية بين الكمبيوتر والجوال، وتجربة مصممة بخصوصية واضحة.",
};

const included = [
  ["◉", "لا يفوتك نداء اسمك", "تنبيه اختياري عندما يسمع NAVIXA اسمك أو كلمة تهمك أثناء الاجتماع أو المحاضرة."],
  ["▣", "راقب ما يهمك فقط", "حدد جزءًا من الشاشة، وNAVIXA ينبهك عند حدوث تغيير مهم بدل مراقبتها طوال الوقت."],
  ["⌁", "كمبيوتر + جوال لحسابك", "جلسة Plus على كمبيوتر واحد وجوال واحد، حتى تبقى تجربتك شخصية ومنظمة."],
];

const trust = [
  ["محلي قدر الإمكان", "الصوت الخام وصور الشاشة لا تُرفع إلى NAVIXA."],
  ["أنت المتحكم", "الميكروفون والشاشة لا يعملان إلا بعد موافقتك."],
  ["بدون مفاجآت", "لا توجد عملية دفع أو طلب بطاقة حتى تُفتح بوابة الدفع الرسمية."],
];

export default function NavixaPlusPage() {
  return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
    <ReferralCapture />
    <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/" className="plus-back">العودة للرئيسية ←</Link></nav>

    <section className="plus-hero" aria-labelledby="plus-title">
      <div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA Plus</span><h1 id="plus-title">خلّ NAVIXA<br /><strong>ينتبه معك.</strong></h1><p>Plus ليس مجرد مزايا إضافية. هو الطبقة التي تجعل NAVIXA يراقب الأشياء الصغيرة التي تستهلك انتباهك، ثم ينبهك عندما تحتاج فعلًا أن تنظر.</p><div className="plus-hero-actions"><a href="#interest" className="primary">أبلغني عند فتح Plus</a><a className="ghost" href="#included">شاهد ما الذي ستحصل عليه</a></div><div className="plus-trust"><span>✓ لا دفع حاليًا</span><span>✓ لا بطاقة</span><span>✓ خصوصية واضحة</span></div></div>
      <aside className="plus-preview" aria-label="لمحة عن تجربة Plus"><span className="preview-badge">مثال</span><div className="preview-screen"><div className="preview-dot" /><small>اجتماعك مستمر…</small><b>تم سماع اسمك</b><p>NAVIXA انتبه لك. ارجع للاجتماع الآن.</p><span className="preview-phone">إشعار على الجوال أيضًا</span></div></aside>
    </section>

    <section className="plus-value" id="included" aria-labelledby="included-title"><header><small>وش يفرق Plus؟</small><h2 id="included-title">أقل مراقبة. أكثر انتباه.</h2><p>ثلاث إضافات مركزة تعطيك فائدة واضحة من أول استخدام، بدون تحويل NAVIXA إلى لوحة مزدحمة.</p></header><div className="plus-feature-grid">{included.map(([icon, title, description]) => <article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>

    <section className="plus-confidence" aria-labelledby="confidence-title"><div className="plus-confidence-copy"><small>قبل ما تشترك</small><h2 id="confidence-title">اعرف بالضبط وش يشتغل ووش ما يشتغل.</h2><p>نبي قرار الاشتراك يكون سهل لأن القيمة واضحة، مو لأن الصفحة ضغطت عليك.</p></div><div className="plus-confidence-grid">{trust.map(([title, description]) => <article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>

    <section className="plus-status" aria-labelledby="plus-status-title"><div><span className="plus-status-icon">i</span><div><small>الحالة الحالية</small><h2 id="plus-status-title">Plus جاهز للتجهيز، والدفع ننتظر اعتماده</h2><p>نقدر الآن نسجل اهتمامك فقط. عند فتح بوابة الدفع الرسمية ستظهر الخطة والسعر وكل التفاصيل قبل أي تحصيل.</p></div></div><Link href="/account">إدارة حسابك ←</Link></section>

    <InterestForm />

    <section className="plus-promise"><div><small>وعد NAVIXA</small><h2>بياناتك ليست ثمن الاشتراك.</h2><p>لن تحفظ NAVIXA بيانات بطاقات أو محافظ. وعند إتاحة الدفع رسميًا سيكون عبر مزود معتمد وتحقيق خادمي آمن.</p></div><Link href="/privacy">اقرأ سياسة الخصوصية ←</Link></section>
    <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span>NAVIXA Plus · القيمة أولًا، والاشتراك بدون مفاجآت</span></footer>
  </main>;
}
