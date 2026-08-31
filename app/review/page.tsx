import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NAVIXA | الخدمات والاشتراك",
  description: "صفحة عامة لمراجعة خدمات NAVIXA وحالة التجربة المجانية والباقات والأسعار والسياسات قبل تفعيل الدفع.",
};

const services = [
  ["تنظيم اليوم والإنتاجية", "مهام وتركيز وتذكيرات وأدوات تساعد المستخدم على إدارة يومه من مكان واحد."],
  ["التنبيهات الذكية", "تنبيهات اختيارية للأحداث المهمة، مع قنوات تنبيه متعددة بحسب إعدادات المستخدم."],
  ["الصحة والعبادة", "أدوات مساندة للعادات الصحية والعبادات ضمن تجربة موحدة."],
  ["NAVIXA Sprint", "باقة قصيرة لمدة خمسة أيام للدورات والمحاضرات والاجتماعات المكثفة، وتشمل الأدوات المرتبطة بهذه الاستخدامات."],
  ["NAVIXA Plus", "باقة أوسع تشمل مزايا متقدمة مثل الاستماع الاختياري للاسم ومتابعة الشاشة والاستمرارية بين الكمبيوتر والجوال."],
];

const plans = [
  { name: "NAVIXA Sprint", duration: "5 أيام متتالية", price: "12 ر.س", note: "للدورات والاجتماعات والاستخدام المكثف القصير." },
  { name: "NAVIXA Plus", duration: "شهر واحد", price: "25 ر.س", note: "للاستخدام المستمر والمزايا المتقدمة." },
];

export default function PublicReviewPage() {
  return <main dir="rtl" style={{maxWidth:960,margin:"0 auto",padding:"32px 20px 64px",fontFamily:"inherit",lineHeight:1.8}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
      <Link href="/" style={{fontWeight:900,fontSize:22,textDecoration:"none"}}><span dir="ltr">NAVIXA SA</span></Link>
      <nav style={{display:"flex",gap:14,flexWrap:"wrap"}}><Link href="/terms">الشروط</Link><Link href="/privacy">الخصوصية</Link><Link href="/refunds">الإلغاء والاسترداد</Link><Link href="/delivery">التسليم والتنفيذ</Link><Link href="/complaints">الشكاوى</Link><Link href="/support">التواصل والدعم</Link></nav>
    </header>
    <section style={{padding:"56px 0 30px"}}><small>navixa يفهم يومك</small><h1 style={{fontSize:"clamp(34px,6vw,62px)",lineHeight:1.15,margin:"8px 0 18px"}}>خدمات NAVIXA واضحة ومفتوحة للمراجعة</h1><p style={{fontSize:19,maxWidth:760}}>NAVIXA منصة رقمية لتنظيم اليوم والإنتاجية والصحة والعبادة والتنبيهات الذكية. الموقع متاح حاليًا للدخول والتجربة العامة دون تسجيل، حتى يتمكن المستخدم ومزود الخدمة من مراجعة المنتج قبل إطلاق الاشتراكات المدفوعة.</p></section>
    <section aria-labelledby="services"><h2 id="services">الخدمات</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{services.map(([title,text])=><article key={title} style={{border:"1px solid #d9e3e1",borderRadius:18,padding:18}}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section style={{marginTop:34,padding:22,border:"1px solid #d9e3e1",borderRadius:18}} aria-labelledby="trial"><h2 id="trial">الحالة الحالية</h2><p><strong>السعر الحالي للمستخدم: 0 ر.س.</strong> جميع المزايا المتاحة في التجربة العامة مفتوحة مجانًا حتى نهاية يوم السبت 12 سبتمبر 2026 بتوقيت السعودية.</p><p>لا يتم تحصيل أي مبلغ ولا طلب بيانات بطاقة خلال هذه الفترة. يبدأ نموذج الاشتراكات بعد انتهاء التجربة المجانية، ولن تُفعّل عملية شراء قبل اعتماد مزود الدفع رسميًا.</p></section>
    <section style={{marginTop:34}} aria-labelledby="pricing"><h2 id="pricing">الأسعار القياسية بعد الفترة المجانية</h2><p>هذه هي الأسعار الأساسية المعتمدة للباقات بعد انتهاء الفترة المجانية. لا تعرض هذه الصفحة عروضًا ترويجية أو أسعار مؤسسين.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>{plans.map(plan=><article key={plan.name} style={{border:"1px solid #d9e3e1",borderRadius:18,padding:20}}><h3>{plan.name}</h3><p><strong>{plan.price}</strong></p><p>المدة: <strong>{plan.duration}</strong></p><p>{plan.note}</p></article>)}</div><p style={{marginTop:16}}>طريقة التسعير: سعر ثابت لكل مدة موضحة أعلاه. يظهر السعر والمدة والمزايا المشمولة قبل الدفع، ولا يتم التجديد أو التحصيل إلا وفق ما يظهر للمستخدم عند الشراء. أي باقات أو مدد إضافية لا تعرض للبيع إلا بعد تفعيلها رسميًا وإظهار سعرها بوضوح.</p><div style={{display:"flex",gap:14,flexWrap:"wrap"}}><Link href="/sprint">تفاصيل NAVIXA Sprint ←</Link><Link href="/plus">تفاصيل NAVIXA Plus ←</Link></div></section>
    <section style={{marginTop:34}} aria-labelledby="policies"><h2 id="policies">السياسات والتواصل</h2><p>جميع المستندات التالية متاحة للعامة دون إنشاء حساب: <Link href="/terms">الشروط والأحكام</Link>، <Link href="/privacy">سياسة الخصوصية</Link>، <Link href="/refunds">سياسة الإلغاء والاسترداد</Link>، <Link href="/delivery">سياسة التسليم والتنفيذ</Link>، <Link href="/complaints">سياسة الشكاوى والمقترحات</Link>، و<Link href="/support">الدعم والتواصل</Link>.</p></section>
    <footer style={{marginTop:48,paddingTop:20,borderTop:"1px solid #d9e3e1"}}><p>هذه الصفحة مخصصة أيضًا لتسهيل مراجعة مزودي الدفع والجهات ذات العلاقة، ولا تمنح وصولًا إلى بيانات أو حسابات المستخدمين.</p><Link href="/">العودة إلى NAVIXA ←</Link></footer>
  </main>;
}
