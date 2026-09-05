"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";

type Plan={id:"monthly"|"sprint";name:string;days:number;periodLabel:string;amount:number};
const fallback:Plan[]=[{id:"monthly",name:"هِمّة",days:30,periodLabel:"شهر واحد",amount:2900},{id:"sprint",name:"عَزْم",days:5,periodLabel:"خمسة أيام",amount:1100}];
const riyals=(amount:number)=>(amount/100).toLocaleString("ar-SA",{maximumFractionDigits:2});

export default function PublicPricingStrip(){
  const pathname=usePathname();
  const [plans,setPlans]=useState<Plan[]>(fallback);
  useEffect(()=>{if(pathname!=="/")return;fetch("/api/billing/catalog",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>{if(data?.plans?.length===2)setPlans(data.plans)}).catch(()=>{})},[pathname]);
  if(pathname!=="/")return null;
  return <section className="public-pricing" aria-labelledby="public-pricing-title">
    <div className="public-pricing-head"><div><small>أسعار NAVIXA المعلنة</small><h2 id="public-pricing-title">اختر المدة المناسبة لك</h2><p>السعر المعروض هنا هو السعر الأساسي الذي يعتمد عليه نظام الدفع قبل أي خصم صالح.</p></div><Link href="/pricing">كل تفاصيل الأسعار ←</Link></div>
    <div className="public-pricing-grid">{plans.map(plan=>{const href=plan.id==="monthly"?"/plus":"/sprint";return <article key={plan.id} className={`public-price-card ${plan.id}`}><div><Link href={href} className="public-plan-name" aria-label={`عرض سعر ومميزات ${plan.name}`}>{plan.name}</Link><small>{plan.periodLabel}</small></div><p><strong>{riyals(plan.amount)}</strong><span>ريال</span></p><Link href={href}>تفاصيل {plan.name} والمميزات ←</Link></article>})}</div>
    <p className="public-pricing-note">اضغط على اسم هِمّة أو عَزْم لعرض السعر ومميزات الباقة. الأسعار بالريال السعودي، ويظهر المبلغ النهائي بوضوح قبل إتمام الدفع.</p>
  </section>;
}
