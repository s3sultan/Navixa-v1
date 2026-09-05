import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import PlanPriceInline from "../PlanPriceInline";
import "../plus/plus.css";
import "../plus/plus-simple.css";

export const metadata: Metadata={title:"NAVIXA عَزْم — خمسة أيام مركزة",description:"NAVIXA عَزْم لمدة خمسة أيام: المزايا المجانية مع سماع الاسم ومراقبة الشاشة لهدف قصير ومركز."};

const included=[
  ["◉","سماع الاسم والكلمات المهمة","تنبيه اختياري عندما يسمع NAVIXA اسمك أو كلمة تختارها أثناء الدورة أو الاجتماع."],
  ["▣","مراقبة الشاشة","حدد الجزء المهم من الشاشة ليلاحظ NAVIXA التغييرات التي تحتاج انتباهك."],
  ["✓","المزايا المجانية","تستمر معك المزايا الأساسية المجانية في NAVIXA طوال مدة عَزْم."],
];
const trust=[
  ["خمسة أيام من العَزْم","باقة قصيرة ومحددة المدة، مناسبة لهدف قريب أو احتياج مكثف."],
  ["بدون خدمات AI الثقيلة","عَزْم لا تشمل ملخصات الجلسات أو التلخيص الذكي والخدمات الثقيلة المخصصة لهِمّة."],
  ["سعر واضح","السعر الرسمي معلن دائمًا في قائمة الأسعار، ويظهر المبلغ النهائي مرة أخرى قبل الدفع."],
];

export default function SprintPage(){return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
  <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/plus" className="plus-back">قارن مع هِمّة ←</Link></nav>
  <section className="plus-hero" aria-labelledby="sprint-title"><div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA عَزْم · خمسة أيام</span><h1 id="sprint-title">عندك هدف قريب؟<br/><strong>ابدأ بعَزْم.</strong></h1><p>باقة مركزة لمدة خمسة أيام تجمع المزايا المجانية مع سماع الاسم ومراقبة الشاشة. مناسبة للدورات والاختبارات والاجتماعات المكثفة بدون تحميل الباقة بخدمات الذكاء الاصطناعي الثقيلة.</p><div className="plus-hero-actions"><Link href="/pricing" className="primary">شاهد السعر الرسمي</Link><a href="#included" className="ghost">وش يشمل؟</a><Link href="/plus" className="ghost">أحتاج هِمّة بكامل المزايا</Link></div><div className="plus-trust"><span>✓ السعر الرسمي <PlanPriceInline plan="sprint" suffix=" / 5 أيام" /></span><span>✓ معلن قبل الدفع</span><span>✓ بدون التزام شهري</span></div></div><aside className="plus-preview" aria-label="لمحة عن تجربة عَزْم"><span className="preview-badge">عَزْم</span><div className="preview-screen"><div className="preview-dot"/><small>هدفك مستمر…</small><b>تم سماع اسمك</b><p>NAVIXA ينتبه للاسم والتغييرات المهمة على الشاشة معك.</p><span className="preview-phone">5 أيام من العَزْم</span></div></aside></section>
  <section className="plus-value" id="included" aria-labelledby="sprint-included"><header><small>وش تحصل عليه؟</small><h2 id="sprint-included">المهم لهدفك، بدون خدمات ثقيلة.</h2><p>عَزْم تشمل المزايا المجانية في NAVIXA، ويضاف إليها سماع الاسم ومراقبة الشاشة لمدة خمسة أيام.</p></header><div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
  <section className="plus-confidence" id="sprint-details" aria-labelledby="sprint-details-title"><div className="plus-confidence-copy"><small>المدة والسعر</small><h2 id="sprint-details-title"><PlanPriceInline plan="sprint" /> مقابل خمسة أيام من العَزْم.</h2><p>مناسبة لاحتياج قصير ومركز. تبدأ المدة بعد تفعيل الاشتراك، وعَزْم باقة محددة المدة وليست اشتراكًا شهريًا. الملخصات والتلخيص الذكي والخدمات الثقيلة ليست ضمن عَزْم.</p></div><div className="plus-confidence-grid">{trust.map(([title,description])=><article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>
  <section className="plus-status"><div><span className="plus-status-icon">i</span><div><small>السعر والشراء</small><h2>سعر عَزْم معلن بوضوح</h2><p>السعر الأساسي الحالي <PlanPriceInline plan="sprint" suffix=" لمدة خمسة أيام" />. وعند فتح الدفع سيُقرأ السعر من إعدادات الخادم نفسها، ثم يظهر المبلغ النهائي مرة أخرى قبل إتمام العملية.</p></div></div><Link href="/pricing">قائمة الأسعار ←</Link></section>
  <section className="plus-promise"><div><small>عَزْم أو هِمّة؟</small><h2>اختر الوصول الذي تحتاجه.</h2><p><strong>عَزْم:</strong> المزايا المجانية + سماع الاسم + مراقبة الشاشة لمدة خمسة أيام. <strong>هِمّة:</strong> الوصول الكامل إلى مزايا NAVIXA المدفوعة والمشاريع المشمولة لمدة شهر.</p></div><Link href="/plus">شاهد تفاصيل هِمّة ←</Link></section>
  <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span><Link href="/pricing">الأسعار</Link> · <Link href="/terms">الشروط</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/refunds">الإلغاء والاسترداد</Link> · <Link href="/support">الدعم</Link></span></footer>
</main>}
