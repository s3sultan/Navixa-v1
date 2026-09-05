"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import "../public-pricing.css";
import "./pricing-comparison.css";

type Plan={id:"monthly"|"sprint";name:string;days:number;periodLabel:string;amount:number};
const fallback:Plan[]=[{id:"monthly",name:"هِمّة",days:30,periodLabel:"شهر واحد",amount:2900},{id:"sprint",name:"عَزْم",days:5,periodLabel:"خمسة أيام",amount:1100}];
const riyals=(amount:number)=>(amount/100).toLocaleString("ar-SA",{maximumFractionDigits:2});
const yes=<span className="pricing-yes" aria-label="متاح">✓</span>;
const no=<span className="pricing-no" aria-label="غير متاح">—</span>;

const rows=[
  ["سماع نداء الاسم والكلمات المهمة",no,yes,yes],
  ["مراقبة جزء من الشاشة والتنبيه عند التغيّر",no,yes,yes],
  ["تلخيص الجلسات واستخراج المهام والمواعيد",no,yes,yes],
  ["التقاط المواعيد والمهام المهمة أثناء الجلسة",no,yes,yes],
  ["NAVIXA English Learning",no,no,yes],
  ["NAVIXA Kids",no,no,yes],
  ["NAVIXA Fitness",no,no,yes],
  ["المدة",<span className="pricing-text">أساسيات مجانية</span>,<span className="pricing-text">5 أيام</span>,<span className="pricing-text">شهر كامل</span>],
];

export default function PricingPage(){
  const [plans,setPlans]=useState<Plan[]>(fallback);
  useEffect(()=>{fetch("/api/billing/catalog",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>{if(data?.plans?.length===2)setPlans(data.plans)}).catch(()=>{})},[]);
  const himma=plans.find(plan=>plan.id==="monthly")||fallback[0];
  const azm=plans.find(plan=>plan.id==="sprint")||fallback[1];
  return <main dir="rtl" style={{minHeight:"100vh",padding:"28px 0",background:"#f7f8fa"}}>
    <section className="public-pricing" aria-labelledby="pricing-title">
      <div className="public-pricing-head"><div><small>NAVIXA SA · قائمة الأسعار الرسمية</small><h1 id="pricing-title" style={{margin:0,fontSize:"clamp(30px,3vw,46px)"}}>الأسعار والمقارنة</h1><p>اختر حسب حاجتك. عَزْم للهدف القصير، وهِمّة للاستمرار والوصول إلى منظومة NAVIXA كاملة.</p></div><Link href="/">العودة للرئيسية ←</Link></div>
      <div className="public-pricing-grid">{plans.map(plan=>{const href=plan.id==="monthly"?"/plus":"/sprint";return <article key={plan.id} className={`public-price-card ${plan.id}`}><div><Link href={href} className="public-plan-name" aria-label={`عرض سعر ومميزات ${plan.name}`}>{plan.name}</Link><small>{plan.periodLabel}</small></div><p><strong>{riyals(plan.amount)}</strong><span>ريال</span></p><Link href={href}>عرض السعر والمميزات ←</Link></article>})}</div>

      <section className="pricing-compare" aria-labelledby="compare-title">
        <header className="pricing-compare-head"><div><small>مقارنة مباشرة</small><h2 id="compare-title">وش يفتح لك كل خيار؟</h2><p>✓ تعني أن الميزة مشمولة. علامة — تعني أنها غير مشمولة في هذه الخطة.</p></div><span className="pricing-recommendation">هِمّة هي الخطة الأشمل</span></header>
        <div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th>الميزة</th><th className="free"><div className="pricing-plan-head"><strong>المجانية</strong><small>0 ريال</small></div></th><th className="azm"><div className="pricing-plan-head"><Link href="/sprint">عَزْم</Link><small>{riyals(azm.amount)} ريال · 5 أيام</small></div></th><th className="himma"><div className="pricing-plan-head"><Link href="/plus">هِمّة</Link><small>{riyals(himma.amount)} ريال · شهر</small></div></th></tr></thead><tbody>{rows.map(([feature,free,azmValue,himmaValue])=><tr key={String(feature)}><td>{feature}</td><td>{free}</td><td>{azmValue}</td><td>{himmaValue}</td></tr>)}</tbody></table></div>
        <div className="pricing-clarity"><article><b>المجانية</b><p>للأساسيات والتعرّف على NAVIXA بدون أدوات الجلسة المدفوعة.</p></article><article className="short"><b>عَزْم</b><p>مناسب لدورة، اختبار، مؤتمر أو فترة قصيرة تحتاج فيها أدوات الاستماع والمتابعة والتلخيص.</p></article><article className="best"><b>هِمّة</b><p>الأشمل: أدوات NAVIXA المدفوعة لمدة شهر، ومعها English Learning وKids وFitness.</p></article></div>
      </section>

      <p className="public-pricing-note">قد يطبق كود خصم صالح عند توفره، ويعرض السعر النهائي قبل الدفع. لا تخزن NAVIXA بيانات البطاقة، وتتم معالجة الدفع عبر مزود الدفع المعتمد.</p>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:18,fontWeight:700,fontSize:14}}><Link href="/terms">الشروط</Link><Link href="/privacy">الخصوصية</Link><Link href="/refunds">الإلغاء والاسترداد</Link><Link href="/support">الدعم</Link></div>
    </section>
  </main>;
}
