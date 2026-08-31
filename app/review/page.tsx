import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NAVIXA | الخدمات والاشتراك",
  description: "صفحة عامة لمراجعة خدمات NAVIXA وحالة التجربة المجانية والباقات والسياسات قبل تفعيل الدفع.",
};

const services = [
  ["تنظيم اليوم والإنتاجية", "مهام وتركيز وتذكيرات وأدوات تساعد المستخدم على إدارة يومه من مكان واحد."],
  ["التنبيهات الذكية", "تنبيهات اختيارية للأحداث المهمة، مع قنوات تنبيه متعددة بحسب إعدادات المستخدم."],
  ["الصحة والعبادة", "أدوات مساندة للعادات الصحية والعبادات ضمن تجربة موحدة."],
  ["NAVIXA Sprint", "باقة قصيرة لمدة خمسة أيام للدورات والمحاضرات والاجتماعات المكثفة، وتشمل الأدوات المرتبطة بهذه الاستخدامات."],
  ["NAVIXA Plus", "باقة أوسع تشمل مزايا متقدمة مثل الاستماع الاختياري للاسم ومتابعة الشاشة والاستمرارية بين الكمبيوتر والجوال."],
];

export default function PublicReviewPage() {
  return <main dir="rtl" style={{maxWidth:960,margin:"0 auto",padding:"32px 20px 64px",fontFamily:"inherit",lineHeight:1.8}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
      <Link href="/" style={{fontWeight:900,fontSize:22,textDecoration:"none"}}><span dir="ltr">NAVIXA SA</span></Link>
      <nav style={{display:"flex",gap:14,flexWrap:"wrap"}}><Link href="/terms">الشروط</Link><Link href="/privacy">الخصوصية</Link><Link href="/refunds">الإلغاء والاسترداد</Link><Link href="/support">التواصل والدعم</Link></nav>
    </header>

    <section style={{padding:"56px 0 30px"}}>
      <small>navixa يفهم يومك</small>
      <h1 style={{fontSize:"clamp(34px,6vw,62px)",lineHeight:1.15,margin:"8px 0 18px"}}>خدمات NAVIXA واضحة ومفتوحة للمراجعة</h1>
      <p style={{fontSize:19,maxWidth:760}}>NAVIXA منصة رقمية لتنظيم اليوم والإنتاجية والصحة والعبادة والتنبيهات الذكية. الموقع متاح حاليًا للدخول والتجربة العامة دون تسجيل، حتى يتمكن المستخدم ومزود الخدمة من مراجعة المنتج قبل إطلاق الاشتراكات المدفوعة.</p>
    </section>

    <section aria-labelledby="services"><h2 id="services">الخدمات</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{services.map(([title,text])=><article key={title} style={{border:"1px solid #d9e3e1",borderRadius:18,padding:18}}><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section style={{marginTop:34,padding:22,border:"1px solid #d9e3e1",borderRadius:18}} aria-labelledby="trial">
      <h2 id="trial">الحالة الحالية والسعر</h2>
      <p><strong>السعر الحالي: 0 ر.س.</strong> جميع المزايا المتاحة في التجربة العامة مفتوحة مجانًا حتى نهاية يوم السبت 12 سبتمبر 2026 بتوقيت السعودية.</p>
      <p>لا يتم تحصيل أي مبلغ ولا طلب بيانات بطاقة خلال هذه الفترة. يبدأ نموذج الاشتراكات بعد انتهاء التجربة المجانية، ولن تُعرض أي عملية شراء قبل اعتماد مزود الدفع رسميًا.</p>
    </section>

    <section style={{marginTop:34,padding:22,border:"1px solid #d9e3e1",borderRadius:18}} aria-labelledby="subscription">
      <h2 id="subscription">الباقات بعد الفترة المجانية</h2>
      <p><strong>Sprint:</strong> مدة خمسة أيام للدورات والاجتماعات والاستخدام المكثف القصير. <strong>Plus:</strong> الباقة الأوسع للاستخدام المستمر والمزايا المتقدمة.</p>
      <p>الأسعار المستقبلية ليست معروضة للبيع حاليًا. عند فتح الاشتراكات رسميًا سيظهر <strong>السعر النهائي والمدة والمزايا المشمولة</strong> بوضوح قبل التسجيل للدفع أو إتمام أي عملية، مع إتاحة الشروط وسياسة الإلغاء والاسترداد.</p>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}><Link href="/sprint">استعراض NAVIXA Sprint ←</Link><Link href="/plus">استعراض NAVIXA Plus ←</Link></div>
    </section>

    <section style={{marginTop:34}} aria-labelledby="policies"><h2 id="policies">السياسات والتواصل</h2><p>يمكن مراجعة المستندات العامة دون إنشاء حساب: <Link href="/terms">الشروط والأحكام</Link>، <Link href="/privacy">سياسة الخصوصية</Link>، <Link href="/refunds">سياسة الإلغاء والاسترداد</Link>، و<Link href="/support">الدعم والتواصل</Link>.</p></section>

    <footer style={{marginTop:48,paddingTop:20,borderTop:"1px solid #d9e3e1"}}><p>هذه الصفحة مخصصة أيضًا لتسهيل مراجعة مزودي الدفع والجهات ذات العلاقة، ولا تمنح وصولًا إلى بيانات أو حسابات المستخدمين.</p><Link href="/">العودة إلى NAVIXA ←</Link></footer>
  </main>;
}
