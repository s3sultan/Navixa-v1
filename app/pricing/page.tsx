"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import AccessComparison from "../AccessComparison";
import "../public-pricing.css";

type Plan={id:"monthly"|"sprint";name:string;days:number;periodLabel:string;amount:number};
const fallback:Plan[]=[{id:"monthly",name:"هِمّة",days:30,periodLabel:"شهر واحد",amount:2900},{id:"sprint",name:"عَزْم",days:5,periodLabel:"خمسة أيام",amount:1100}];
const riyals=(amount:number)=>(amount/100).toLocaleString("ar-SA",{maximumFractionDigits:2});

export default function PricingPage(){
  const [plans,setPlans]=useState<Plan[]>(fallback);
  useEffect(()=>{fetch("/api/billing/catalog",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>{if(data?.plans?.length===2)setPlans(data.plans)}).catch(()=>{})},[]);
  return <main dir="rtl" style={{minHeight:"100vh",padding:"28px 0",background:"#f7f8fa"}}><section className="public-pricing" aria-labelledby="pricing-title">
    <div className="public-pricing-head"><div><small>NAVIXA SA · قائمة الأسعار الرسمية</small><h1 id="pricing-title" style={{margin:0,fontSize:"clamp(30px,3vw,46px)"}}>الأسعار</h1><p>اختر ما يناسب استخدامك. هِمّة تفتح كامل NAVIXA، وعَزْم للمراقبة ونداء الاسم مع المزايا المجانية.</p></div><Link href="/">العودة للرئيسية ←</Link></div>
    <div className="public-pricing-grid">{plans.map(plan=>{const href=plan.id==="monthly"?"/plus":"/sprint";const scope=plan.id==="monthly"?"كامل مميزات NAVIXA والمشاريع المشمولة":"مراقبة الشاشة + نداء الاسم + المزايا المجانية";return <article key={plan.id} className={`public-price-card ${plan.id}`}><div><Link href={href} className="public-plan-name" aria-label={`عرض سعر ومميزات ${plan.name}`}>{plan.name}</Link><small>{plan.periodLabel}</small></div><p><strong>{riyals(plan.amount)}</strong><span>ريال</span></p><p style={{fontWeight:700,fontSize:14}}>{scope}</p><Link href={href}>عرض السعر والمميزات ←</Link></article>})}</div>
    <article style={{marginTop:18,padding:18,borderRadius:18,background:"#fff",border:"1px solid #e5e7eb"}}><strong>فترة الإطلاق التجريبية</strong><p style={{marginBottom:0}}>استخدام مجاني ومحدود لكامل NAVIXA حتى السبت 12 سبتمبر 2026 الساعة 4:00 مساءً بتوقيت السعودية. بعد انتهائها تعود الحسابات غير المشتركة إلى المزايا المجانية.</p></article>
    <AccessComparison />
    <p className="public-pricing-note">قد يطبق كود خصم صالح عند توفره، ويعرض السعر النهائي قبل الدفع. لا تخزن NAVIXA بيانات البطاقة، وتتم معالجة الدفع عبر مزود الدفع المعتمد.</p>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:18,fontWeight:700,fontSize:14}}><Link href="/terms">الشروط</Link><Link href="/privacy">الخصوصية</Link><Link href="/refunds">الإلغاء والاسترداد</Link><Link href="/support">الدعم</Link></div>
  </section></main>;
}
