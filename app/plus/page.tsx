import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import "./plus.css";
import "./plus-simple.css";
import InterestForm from "./InterestForm";
import ReferralCapture from "./ReferralCapture";

export const metadata: Metadata = {
  title: "NAVIXA Plus — يومك أهدأ وأذكى",
  description: "NAVIXA Plus لمدة شهر: أدوات الاستماع والتنبيه ومراقبة الشاشة والملخصات والاستمرارية بين الكمبيوتر والجوال.",
};

const included = [
  ["◉", "سماع الاسم والكلمات المهمة", "تنبيه اختياري عندما يسمع NAVIXA اسمك أو كلمة تختارها أثناء الاجتماع أو المحاضرة."],
  ["▣", "مراقبة الشاشة", "حدد الجزء المهم من الشاشة ليلاحظ NAVIXA التغييرات التي تحتاج انتباهك."],
  ["✦", "ملخصات الجلسات", "تلخيص الجلسات الطويلة واستخراج أهم القرارات والمهام والمواعيد."],
  ["⌁", "كمبيوتر + جوال لحسابك", "استخدام حساب Plus على كمبيوتر واحد وجوال واحد وفق سياسة الأجهزة."],
  ["∞", "مدة شهر كامل", "مناسب للاستخدام المستمر في الدراسة والعمل والاجتماعات طوال الشهر."],
];

const trust = [
  ["محلي قدر الإمكان", "الصوت الخام وصور الشاشة لا تُرفع إلى NAVIXA."],
  ["أنت المتحكم", "الميكروفون والشاشة لا يعملان إلا بعد موافقتك."],
  ["سعر واضح", "السعر القياسي 25 ر.س لمدة شهر واحد، ويظهر أي عرض ساري قبل الدفع."],
];

export default function NavixaPlusPage() {
  return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
    <ReferralCapture />
    <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/sprint" className="plus-back">قارن مع Sprint ←</Link></nav>
    <section className="plus-hero" aria-labelledby="plus-title"><div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA Plus · شهر كامل</span><h1 id="plus-title">خلّ NAVIXA<br /><strong>ينتبه معك.</strong></h1><p>الباقة الكاملة للاستخدام المستمر في الدراسة والعمل والاجتماعات، مع أدوات الانتباه والمتابعة والملخصات لمدة شهر.</p><div className="plus-hero-actions"><a href="#included" className="primary">شاهد ما يشمله Plus</a><Link className="ghost" href="/sprint">أحتاجه لخمسة أيام فقط</Link></div><div className="plus-trust"><span>✓ 25 ر.س / شهر</span><span>✓ كمبيوتر + جوال</span><span>✓ المزايا موضحة قبل الدفع</span></div></div><aside className="plus-preview" aria-label="لمحة عن تجربة Plus"><span className="preview-badge">مثال</span><div className="preview-screen"><div className="preview-dot" /><small>اجتماعك مستمر…</small><b>تم سماع اسمك</b><p>NAVIXA انتبه لك. ارجع للاجتماع الآن.</p><span className="preview-phone">إشعار على الجوال أيضًا</span></div></aside></section>
    <section className="plus-value" id="included" aria-labelledby="included-title"><header><small>وش تحصل عليه؟</small><h2 id="included-title">Plus واضح من قبل الاشتراك.</h2><p>هذه هي المزايا الأساسية المشمولة في باقة Plus لمدة شهر.</p></header><div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
    <section className="plus-confidence" aria-labelledby="confidence-title"><div className="plus-confidence-copy"><small>Plus أو Sprint؟</small><h2 id="confidence-title">اختر حسب المدة، لا حسب التخمين.</h2><p><strong>Plus:</strong> شهر كامل بـ25 ر.س للاستخدام المستمر. <strong>Sprint:</strong> خمسة أيام بـ12 ر.س للدورات والاجتماعات القصيرة. Sprint يركز على أدوات الجلسات المكثفة، بينما Plus هو الخيار الأطول والأشمل للاستخدام المستمر.</p><Link href="/sprint">شاهد تفاصيل Sprint ←</Link></div><div className="plus-confidence-grid">{trust.map(([title,description])=><article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>
    <section className="plus-status" aria-labelledby="plus-status-title"><div><span className="plus-status-icon">i</span><div><small>السعر والمدة</small><h2 id="plus-status-title">NAVIXA Plus · 25 ر.س / شهر</h2><p>السعر القياسي <strong>25 ر.س لمدة شهر واحد</strong>. خلال التجربة العامة الحالية لا يتم تحصيل مبلغ أو طلب بطاقة. وعند فتح الدفع سيظهر السعر والمدة والمزايا المشمولة مرة أخرى قبل إتمام العملية.</p></div></div><Link href="/account">إدارة حسابك ←</Link></section>
    <InterestForm />
    <section className="plus-promise"><div><small>وعد NAVIXA</small><h2>تعرف وش تشتري قبل ما تدفع.</h2><p>لن تحفظ NAVIXA بيانات بطاقات أو محافظ. الدفع عبر مزود معتمد، ولن يُفعّل الاشتراك إلا بعد تحقق خادمي من العملية.</p></div><Link href="/privacy">اقرأ سياسة الخصوصية ←</Link></section>
    <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span><Link href="/terms">الشروط</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/refunds">الإلغاء والاسترداد</Link> · <Link href="/support">الدعم</Link></span></footer>
  </main>;
}
