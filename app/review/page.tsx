import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NAVIXA | الخدمات والاشتراك",
  description: "صفحة عامة توضح خدمة NAVIXA ومزاياها وحالة الاشتراك والسياسات النظامية قبل تفعيل الدفع.",
};

const services = [
  ["تنظيم اليوم والإنتاجية", "مهام وتركيز وتذكيرات وأدوات تساعد المستخدم على إدارة يومه من مكان واحد."],
  ["التنبيهات الذكية", "تنبيهات اختيارية للأحداث المهمة، مع قنوات تنبيه متعددة بحسب إعدادات المستخدم."],
  ["الصحة والعبادة", "أدوات مساندة للعادات الصحية والعبادات ضمن تجربة موحدة."],
  ["NAVIXA Plus", "مزايا متقدمة مثل الاستماع الاختياري للاسم ومتابعة التغييرات المهمة واستمرارية التجربة بين الكمبيوتر والجوال."],
];

export default function PublicReviewPage() {
  return <main dir="rtl" style={{maxWidth:960,margin:"0 auto",padding:"32px 20px 64px",fontFamily:"inherit",lineHeight:1.8}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
      <Link href="/" style={{fontWeight:900,fontSize:22,textDecoration:"none"}}><span dir="ltr">NAVIXA SA</span></Link>
      <nav style={{display:"flex",gap:14,flexWrap:"wrap"}}><Link href="/terms">الشروط</Link><Link href="/privacy">الخصوصية</Link><Link href="/refunds">الإلغاء والاسترداد</Link><Link href="/support">التواصل والدعم</Link></nav>
    </header>

    <section style={{padding:"56px 0 30px"}}>
      <small>navixa يفهم يومك</small>
      <h1 style={{fontSize:"clamp(34px,6vw,62px)",lineHeight:1.15,margin:"8px 0 18px"}}>خدمات NAVIXA واضحة قبل التسجيل</h1>
      <p style={{fontSize:19,maxWidth:760}}>NAVIXA منصة رقمية لتنظيم اليوم والإنتاجية والصحة والعبادة والتنبيهات الذكية. هذه الصفحة عامة ولا تحتاج تسجيل دخول، وتوضح طبيعة الخدمة والسياسات وحالة الاشتراك قبل تفعيل أي عملية دفع.</p>
    </section>

    <section aria-labelledby="services"><h2 id="services">الخدمات</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{services.map(([title,text])=><article key={title} style={{border:"1px solid #d9e3e1",borderRadius:18,padding:18}}><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section style={{marginTop:34,padding:22,border:"1px solid #d9e3e1",borderRadius:18}} aria-labelledby="subscription">
      <h2 id="subscription">الاشتراك والدفع</h2>
      <p><strong>NAVIXA Plus غير متاح للبيع حاليًا.</strong> بوابة الدفع ما زالت بانتظار الاعتماد والتفعيل، لذلك لا يتم تحصيل أي مبلغ ولا طلب بيانات بطاقة الآن.</p>
      <p>عند فتح الاشتراك رسميًا سيظهر <strong>السعر النهائي ومدة الاشتراك وما يشمله</strong> بوضوح قبل الدفع، مع إتاحة الشروط وسياسة الإلغاء والاسترداد للمستخدم قبل إتمام العملية.</p>
      <Link href="/plus">استعراض NAVIXA Plus ←</Link>
    </section>

    <section style={{marginTop:34}} aria-labelledby="policies"><h2 id="policies">السياسات والتواصل</h2><p>يمكن مراجعة المستندات العامة دون إنشاء حساب: <Link href="/terms">الشروط والأحكام</Link>، <Link href="/privacy">سياسة الخصوصية</Link>، <Link href="/refunds">سياسة الإلغاء والاسترداد</Link>، و<Link href="/support">الدعم والتواصل</Link>.</p></section>

    <footer style={{marginTop:48,paddingTop:20,borderTop:"1px solid #d9e3e1"}}><p>هذه الصفحة مخصصة أيضًا لتسهيل مراجعة مزودي الدفع والجهات ذات العلاقة، ولا تمنح وصولًا إلى بيانات أو حسابات المستخدمين.</p><Link href="/">العودة إلى NAVIXA ←</Link></footer>
  </main>;
}
