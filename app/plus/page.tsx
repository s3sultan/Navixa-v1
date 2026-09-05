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

export default function PlusPage(){return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
  <ReferralCapture />
  <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/pricing" className="plus-back">قائمة الأسعار ←</Link></nav>
  <section className="plus-hero" aria-labelledby="plus-title"><div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA هِمّة · 30 يومًا</span><h1 id="plus-title">استمر بهِمّة.<br/><strong>وخلك حاضر.</strong></h1><p>باقة NAVIXA الكاملة للاستماع والتنبيه ومراقبة الشاشة والملخصات والخدمات الذكية المتاحة، لمدة 30 يومًا.</p><div className="plus-hero-actions"><Link href="/pricing" className="primary">شاهد السعر الرسمي</Link><a href="#included" className="ghost">وش يشمل؟</a><Link href="/sprint" className="ghost">أحتاج عَزْم فقط</Link></div><div className="plus-trust"><span>✓ السعر الرسمي <PlanPriceInline plan="monthly" suffix=" / 30 يوم" /></span><span>✓ معلن قبل الدفع</span><span>✓ كمبيوتر + جوال</span></div></div><aside className="plus-preview" aria-label="لمحة عن تجربة هِمّة"><span className="preview-badge">هِمّة</span><div className="preview-screen"><div className="preview-dot"/><small>جلسة مستمرة…</small><b>تم سماع اسمك</b><p>NAVIXA ينتبه للاسم والتغييرات المهمة على الشاشة معك.</p><span className="preview-phone">30 يومًا من هِمّة</span></div></aside></section>
  <section className="plus-value" id="included" aria-labelledby="plus-included"><header><small>وش تحصل عليه؟</small><h2 id="plus-included">كل ما تحتاجه للاستمرار.</h2><p>هِمّة تجمع أدوات NAVIXA المدفوعة والخدمات الذكية المتاحة ضمن الباقة لمدة 30 يومًا.</p></header><div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
  <section className="plus-confidence" id="plus-details" aria-labelledby="plus-details-title"><div className="plus-confidence-copy"><small>المدة والسعر</small><h2 id="plus-details-title"><PlanPriceInline plan="monthly" /> مقابل 30 يومًا من هِمّة.</h2><p>تبدأ المدة بعد تفعيل الاشتراك. السعر النهائي يظهر قبل الدفع، وتخضع الخدمات المتاحة وحدود الاستخدام لسياسة الباقة المعلنة.</p></div><div className="plus-confidence-grid">{trust.map(([title,description])=><article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>
  <InterestForm />
</main>}
