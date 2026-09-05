import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import PlanPriceInline from "../PlanPriceInline";
import "../plus/plus.css";
import "../plus/plus-simple.css";

export const metadata: Metadata={title:"NAVIXA عَزْم — خمسة أيام مركزة",description:"NAVIXA عَزْم لمدة خمسة أيام للمحاضرات والدورات والاجتماعات المكثفة."};

const included=[
  ["◉","سماع الاسم والكلمات المهمة","تنبيه اختياري عندما يسمع NAVIXA اسمك أو كلمة تختارها أثناء الدورة أو الاجتماع."],
  ["▣","مراقبة الشاشة","حدد الجزء المهم من الشاشة ليلاحظ NAVIXA التغييرات التي تحتاج انتباهك."],
  ["✦","ملخصات الجلسات","تلخيص الجلسات الطويلة واستخراج أهم القرارات والمهام والمواعيد."],
  ["⌁","دفعة مركزة لهدف قريب","خل تركيزك على هدفك، ودع NAVIXA يساعدك على التقاط المواعيد والمهام المهمة خلال خمسة أيام."],
];
const trust=[
  ["خمسة أيام من العَزْم","باقة قصيرة ومحددة المدة، مناسبة لهدف قريب أو احتياج مكثف."],
  ["أدوات الجلسة الذكية","الاستماع ومراقبة الشاشة والملخصات ضمن عَزْم."],
  ["نطاق واضح","English Learning وKids وFitness ليست ضمن عَزْم، وهي مشمولة في هِمّة."],
];

export default function SprintPage(){return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
  <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/plus" className="plus-back">قارن مع هِمّة ←</Link></nav>
  <section className="plus-hero" aria-labelledby="sprint-title"><div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA عَزْم · خمسة أيام</span><h1 id="sprint-title">عندك هدف قريب؟<br/><strong>ابدأ بعَزْم.</strong></h1><p>باقة مركزة للدورات، الاختبارات، المؤتمرات والاجتماعات المكثفة. خمسة أيام تعطي هدفك دفعة واضحة بأدوات NAVIXA الأساسية للجلسات بدل دفع قيمة شهر كامل.</p><div className="plus-hero-actions"><Link href="/pricing" className="primary">شاهد السعر والمقارنة</Link><a href="#included" className="ghost">وش يشمل؟</a><Link href="/plus" className="ghost">أحتاج هِمّة لشهر كامل</Link></div><div className="plus-trust"><span>✓ السعر الرسمي <PlanPriceInline plan="sprint" suffix=" / 5 أيام" /></span><span>✓ أدوات الجلسة الذكية</span><span>✓ بدون التزام شهري</span></div></div><aside className="plus-preview" aria-label="لمحة عن تجربة عَزْم"><span className="preview-badge">عَزْم</span><div className="preview-screen"><div className="preview-dot"/><small>هدفك مستمر…</small><b>ركز على الخطوة الحالية</b><p>NAVIXA يلتقط التنبيهات والمهام والمواعيد المهمة معك.</p><span className="preview-phone">5 أيام من العَزْم</span></div></aside></section>
  <section className="plus-value" id="included" aria-labelledby="sprint-included"><header><small>وش تحصل عليه؟</small><h2 id="sprint-included">كل المهم لهدفك المكثف.</h2><p>عَزْم باقة قصيرة وواضحة لمن عنده هدف قريب ويبي يدخل عليه بتركيز، بدون التزام أطول من حاجته.</p></header><div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
  <section className="plus-confidence" id="sprint-details" aria-labelledby="sprint-details-title"><div className="plus-confidence-copy"><small>المدة والسعر</small><h2 id="sprint-details-title"><PlanPriceInline plan="sprint" /> مقابل خمسة أيام من العَزْم.</h2><p>مناسب لدورة قصيرة، أسبوع اختبارات، مؤتمر أو سلسلة اجتماعات مكثفة. تبدأ المدة بعد تفعيل الاشتراك، وعَزْم باقة محددة المدة وليست اشتراكًا شهريًا.</p><Link href="/pricing">شاهد جدول المقارنة الكامل ←</Link></div><div className="plus-confidence-grid">{trust.map(([title,description])=><article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>
  <section className="plus-status"><div><span className="plus-status-icon">i</span><div><small>السعر والشراء</small><h2>سعر عَزْم معلن بوضوح</h2><p>السعر الأساسي الحالي <PlanPriceInline plan="sprint" suffix=" لمدة خمسة أيام" />. وعند فتح الدفع سيُقرأ السعر من إعدادات الخادم نفسها، ثم يظهر المبلغ النهائي مرة أخرى قبل إتمام العملية.</p></div></div><Link href="/pricing">قائمة الأسعار والمقارنة ←</Link></section>
  <section className="plus-promise"><div><small>عَزْم أو هِمّة؟</small><h2>ابدأ بعَزْم، وكمل بهِمّة.</h2><p><strong>عَزْم:</strong> خمسة أيام بسعر <PlanPriceInline plan="sprint" /> لأدوات الجلسة الذكية. <strong>هِمّة:</strong> شهر كامل بسعر <PlanPriceInline plan="monthly" /> مع الوصول إلى English Learning وKids وFitness.</p></div><Link href="/plus">شاهد تفاصيل هِمّة ←</Link></section>
  <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span><Link href="/pricing">الأسعار</Link> · <Link href="/terms">الشروط</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/refunds">الإلغاء والاسترداد</Link> · <Link href="/support">الدعم</Link></span></footer>
</main>}
