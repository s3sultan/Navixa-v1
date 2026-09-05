import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import PlanPriceInline from "../PlanPriceInline";
import "./plus.css";
import "./plus-simple.css";
import InterestForm from "./InterestForm";
import ReferralCapture from "./ReferralCapture";

export const metadata: Metadata = {
  title: "هِمّة | اشتراك NAVIXA لمدة 30 يومًا",
  description: "باقة NAVIXA هِمّة لمدة 30 يومًا تشمل أدوات الاستماع والتنبيه ومراقبة الشاشة والملخصات والخدمات الذكية المتاحة ضمن الباقة.",
  alternates: { canonical: "/plus" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: "/plus", title: "هِمّة | NAVIXA", description: "باقة NAVIXA الكاملة لمدة 30 يومًا للاستماع والتنبيه ومراقبة الشاشة والخدمات الذكية." },
};

const included = [
  ["◉", "سماع الاسم والكلمات المهمة", "تنبيه اختياري عندما يسمع NAVIXA اسمك أو كلمة تختارها أثناء الاجتماع أو المحاضرة."],
  ["▣", "مراقبة الشاشة", "حدد الجزء المهم من الشاشة ليلاحظ NAVIXA التغييرات التي تحتاج انتباهك."],
  ["✦", "ملخصات الجلسات", "تلخيص الجلسات الطويلة واستخراج أهم القرارات والمهام والمواعيد."],
  ["⌁", "كمبيوتر + جوال لحسابك", "استخدام حساب هِمّة على كمبيوتر واحد وجوال واحد وفق سياسة الأجهزة."],
  ["∞", "هِمّة تمتد شهرًا كاملًا", "مناسبة لمن يريد الاستمرار بثبات في الدراسة والعمل والاجتماعات طوال الشهر."],
];

const trust = [
  ["محلي قدر الإمكان", "الصوت الخام وصور الشاشة لا تُرفع إلى NAVIXA."],
  ["أنت المتحكم", "الميكروفون والشاشة لا يعملان إلا بعد موافقتك."],
  ["سعر واضح", "السعر الرسمي معلن دائمًا في قائمة الأسعار، ويظهر المبلغ النهائي مرة أخرى قبل الدفع."],
];

export default function NavixaPlusPage() {
  return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
    <ReferralCapture />
    <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/sprint" className="plus-back">قارن مع عَزْم ←</Link></nav>
    <section className="plus-hero" aria-labelledby="plus-title"><div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA هِمّة · شهر كامل</span><h1 id="plus-title">خلك مستمر<br /><strong>بهمّة.</strong></h1><p>باقة للاستمرار بثبات في الدراسة والعمل والاجتماعات، تجمع أدوات الانتباه والمتابعة والملخصات لمدة شهر كامل حتى تكمل يومك بهِمّة.</p><div className="plus-hero-actions"><Link href="/pricing" className="primary">شاهد السعر الرسمي</Link><a href="#included" className="ghost">شاهد ما تشمله هِمّة</a><Link className="ghost" href="/sprint">أحتاج عَزْم لخمسة أيام</Link></div><div className="plus-trust"><span>✓ السعر الرسمي <PlanPriceInline plan="monthly" suffix=" / شهر" /></span><span>✓ معلن قبل الدفع</span><span>✓ كمبيوتر + جوال</span></div></div><aside className="plus-preview" aria-label="لمحة عن تجربة هِمّة"><span className="preview-badge">هِمّة</span><div className="preview-screen"><div className="preview-dot" /><small>يومك مستمر…</small><b>تم سماع اسمك</b><p>NAVIXA ينتبه معك حتى تواصل بهِمّة.</p><span className="preview-phone">إشعار على الجوال أيضًا</span></div></aside></section>
    <section className="plus-value" id="included" aria-labelledby="included-title"><header><small>وش تحصل عليه؟</small><h2 id="included-title">هِمّة واضحة من قبل الاشتراك.</h2><p>هذه هي المزايا الأساسية المشمولة في باقة هِمّة لمدة شهر.</p></header><div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
    <section className="plus-confidence" aria-labelledby="confidence-title"><div className="plus-confidence-copy"><small>هِمّة أو عَزْم؟</small><h2 id="confidence-title">اختر حسب المدة والطاقة التي تحتاجها.</h2><p><strong>هِمّة:</strong> شهر كامل بسعر <PlanPriceInline plan="monthly" /> للاستمرار والمتابعة على المدى الأطول. <strong>عَزْم:</strong> خمسة أيام بسعر <PlanPriceInline plan="sprint" /> لاحتياج قصير ومكثف.</p><Link href="/sprint">شاهد تفاصيل عَزْم ←</Link></div><div className="plus-confidence-grid">{trust.map(([title,description])=><article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>
    <section className="plus-status" aria-labelledby="plus-status-title"><div><span className="plus-status-icon">i</span><div><small>السعر والشراء</small><h2 id="plus-status-title">سعر هِمّة معلن بوضوح</h2><p>السعر الأساسي الحالي <PlanPriceInline plan="monthly" suffix=" لمدة شهر واحد" />. وعند فتح الدفع سيُقرأ السعر من إعدادات الخادم نفسها، ثم يظهر المبلغ النهائي مرة أخرى قبل إتمام العملية.</p></div></div><Link href="/pricing">قائمة الأسعار ←</Link></section>
    <InterestForm />
    <section className="plus-promise"><div><small>وعد NAVIXA</small><h2>تعرف وش تشتري قبل ما تدفع.</h2><p>لن تحفظ NAVIXA بيانات بطاقات أو محافظ. الدفع عبر مزود معتمد، ولن تُفعّل هِمّة إلا بعد تحقق خادمي من العملية.</p></div><Link href="/privacy">اقرأ سياسة الخصوصية ←</Link></section>
    <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt="" /><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span><Link href="/pricing">الأسعار</Link> · <Link href="/terms">الشروط</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/refunds">الإلغاء والاسترداد</Link> · <Link href="/support">الدعم</Link></span></footer>
  </main>;
}
