import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NAVIXA Sprint | خمسة أيام للدورات والاجتماعات",
  description: "NAVIXA Sprint باقة قصيرة لمدة خمسة أيام للمحاضرات والدورات والاجتماعات المكثفة.",
};

const features = [
  ["سماع الاسم والكلمات المهمة", "ينبهك NAVIXA عند سماع اسمك أو الكلمات التي تختار متابعتها أثناء الدورة أو الاجتماع."],
  ["مراقبة الشاشة", "حدد الجزء المهم من الشاشة ليلاحظ NAVIXA التغييرات التي تحتاج انتباهك."],
  ["ملخصات الجلسات", "حوّل الجلسات الطويلة إلى ملخصات مركزة تساعدك على الرجوع للمهم بسرعة."],
  ["تنبيهات الاجتماعات والدورات", "اجمع المواعيد والقرارات والمهام المهمة خلال فترة Sprint."],
];

export default function SprintPage(){
  return <main dir="rtl" style={{maxWidth:960,margin:"0 auto",padding:"28px 20px 64px",lineHeight:1.8}}>
    <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}><Link href="/" style={{fontWeight:900,textDecoration:"none"}}><span dir="ltr">NAVIXA SA</span></Link><Link href="/plus">قارن مع Plus ←</Link></nav>
    <section style={{padding:"56px 0 28px"}}><span style={{display:"inline-block",padding:"5px 11px",border:"1px solid #b8d9d3",borderRadius:999,fontWeight:800}}>SPRINT · خمسة أيام</span><h1 style={{fontSize:"clamp(36px,7vw,68px)",lineHeight:1.1,margin:"14px 0"}}>دورتك قصيرة؟<br/>اشتراكك يكون قصير.</h1><p style={{fontSize:19,maxWidth:720}}>Sprint مخصص لمن يحتاج أدوات NAVIXA المهمة للدورات والمحاضرات والاجتماعات لفترة مركزة، بدون الحاجة لاشتراك شهر كامل.</p></section>
    <section><h2>وش يفتح لك Sprint؟</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{features.map(([title,text])=><article key={title} style={{border:"1px solid #d9e3e1",borderRadius:18,padding:18}}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section style={{marginTop:32,padding:22,border:"1px solid #d9e3e1",borderRadius:18}}><h2>المدة والسعر</h2><p><strong>المدة: خمسة أيام متتالية من التفعيل.</strong></p><p>السعر المقترح عند فتح الاشتراكات: <strong>9 ريال سعودي</strong>. الدفع غير مفعل حاليًا خلال الفترة المجانية، ولن يتم طلب بطاقة أو تحصيل مبلغ الآن.</p></section>
    <section style={{marginTop:32}}><h2>تحتاج NAVIXA لفترة أطول؟</h2><p>Plus هو الخيار الكامل للاستخدام المستمر والمزايا الأوسع.</p><Link href="/plus">استعرض NAVIXA Plus ←</Link></section>
    <footer style={{marginTop:44,paddingTop:18,borderTop:"1px solid #d9e3e1"}}><Link href="/">العودة إلى NAVIXA ←</Link> · <Link href="/terms">الشروط</Link> · <Link href="/privacy">الخصوصية</Link> · <Link href="/refunds">الإلغاء والاسترداد</Link></footer>
  </main>;
}
