import type { Metadata } from "next";
import Link from "next/link";
import { languageIdentity } from "../content/languages";
import "../plus/plus.css";
import "../plus/plus-simple.css";

export const metadata: Metadata={title:"NAVIXA Sprint — خمسة أيام مركزة",description:"NAVIXA Sprint لمدة خمسة أيام للمحاضرات والدورات والاجتماعات المكثفة بسعر 12 ر.س."};

const included=[
  ["◉","سماع الاسم والكلمات المهمة","تنبيه اختياري عندما يسمع NAVIXA اسمك أو كلمة تختارها أثناء الدورة أو الاجتماع."],
  ["▣","مراقبة الشاشة","حدد الجزء المهم من الشاشة ليلاحظ NAVIXA التغييرات التي تحتاج انتباهك."],
  ["✦","ملخصات الجلسات","تلخيص الجلسات الطويلة واستخراج أهم القرارات والمهام والمواعيد."],
  ["⌁","تنبيهات الدورات والاجتماعات","ركز على الجلسة ودع NAVIXA يساعدك على التقاط المواعيد والمهام المهمة."],
];
const trust=[
  ["خمسة أيام فقط","باقة قصيرة ومحددة المدة، مناسبة للاحتياج المكثف."],
  ["نفس أدوات الجلسة الذكية","الاستماع ومراقبة الشاشة والملخصات ضمن Sprint."],
  ["سعر واضح","السعر القياسي 12 ر.س لمدة خمسة أيام متتالية."],
];

export default function SprintPage(){return <main className="plus-page plus-simple" dir={languageIdentity.ar.direction}>
  <nav className="plus-nav"><Link href="/" className="plus-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><Link href="/plus" className="plus-back">قارن مع Plus ←</Link></nav>
  <section className="plus-hero" aria-labelledby="sprint-title"><div className="plus-hero-copy"><span className="plus-eyebrow">NAVIXA Sprint · خمسة أيام</span><h1 id="sprint-title">احتياجك قصير؟<br/><strong>خل اشتراكك قصير.</strong></h1><p>باقة مركزة للدورات، الاختبارات، المؤتمرات والاجتماعات المكثفة. تحصل على أدوات NAVIXA الأساسية للجلسات لمدة خمسة أيام فقط بدل دفع قيمة شهر كامل.</p><div className="plus-hero-actions"><a href="#sprint-details" className="primary">شاهد تفاصيل Sprint</a><a href="#included" className="ghost">وش يشمل؟</a><Link href="/plus" className="ghost">أحتاج شهر كامل</Link></div><div className="plus-trust"><span>✓ السعر الحالي 0 ر.س</span><span>✓ السعر القياسي 12 ر.س / 5 أيام</span><span>✓ بدون التزام شهري</span></div></div><aside className="plus-preview" aria-label="لمحة عن تجربة Sprint"><span className="preview-badge">Sprint</span><div className="preview-screen"><div className="preview-dot"/><small>جلسة مكثفة مستمرة…</small><b>ركز على الجلسة</b><p>NAVIXA يلتقط التنبيهات والمهام والمواعيد المهمة معك.</p><span className="preview-phone">5 أيام مركزة</span></div></aside></section>
  <section className="plus-value" id="included" aria-labelledby="sprint-included"><header><small>وش تحصل عليه؟</small><h2 id="sprint-included">كل المهم لجلساتك المكثفة.</h2><p>Sprint ليس نسخة مبهمة من Plus. هو باقة قصيرة واضحة تركز على أدوات الجلسة التي تحتاجها الآن.</p></header><div className="plus-feature-grid">{included.map(([icon,title,description])=><article key={title}><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
  <section className="plus-confidence" id="sprint-details" aria-labelledby="sprint-details-title"><div className="plus-confidence-copy"><small>المدة والسعر</small><h2 id="sprint-details-title">12 ر.س مقابل خمسة أيام متتالية.</h2><p>مناسب لدورة قصيرة، أسبوع اختبارات، مؤتمر أو سلسلة اجتماعات مكثفة. تبدأ المدة بعد تفعيل الاشتراك، وSprint باقة محددة المدة وليست اشتراكًا شهريًا.</p></div><div className="plus-confidence-grid">{trust.map(([title,description])=><article key={title}><b>{title}</b><p>{description}</p></article>)}</div></section>
  <section className="plus-status"><div><span className="plus-status-icon">i</span><div><small>الحالة الحالية</small><h2>Sprint متاح ضمن التجربة العامة الآن</h2><p><strong>السعر الحالي 0 ر.س.</strong> عند فتح الدفع سيظهر اسم Sprint والسعر القياسي <strong>12 ر.س</strong> والمدة <strong>خمسة أيام</strong> والمزايا المشمولة قبل تأكيد العملية. حاليًا لا توجد عملية دفع أو طلب بطاقة.</p></div></div><Link href="/plus">هل Plus أنسب لك؟ ←</Link></section>
  <section className="plus-promise"><div><small>Sprint أو Plus؟</small><h2>ادفع على قد المدة التي تحتاجها.</h2><p><strong>Sprint:</strong> خمسة أيام بـ12 ر.س للاحتياج القصير والمكثف. <strong>Plus:</strong> شهر كامل بـ25 ر.س للاستخدام المستمر والأطول.</p></div><Link href="/plus">شاهد تفاصيل Plus ←</Link></section>
  <footer className="plus-footer"><Link href="/" className="plus-brand"><img src="/navixa-mark.webp" alt=""/><span><b dir="ltr">NAVIXA <small className="brand-sa">SA</small></b><small>يفهم يومك</small></span></Link><span><Link href="/terms">الشروط</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/refunds">الإلغاء والاسترداد</Link> · <Link href="/support">الدعم</Link></span></footer>
</main>}
