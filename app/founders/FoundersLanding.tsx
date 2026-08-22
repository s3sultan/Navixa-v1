"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign={
  available:boolean;startAt:string;endAt:string;totalSeats:number;paidSeats:number;reservedSeats:number;remainingSeats:number;message:string;
};
type FounderHonor={found:boolean;available:boolean;badgeUntil?:string;title?:string;message?:string};

const empty:Campaign={available:false,startAt:"2026-08-21T21:00:00.000Z",endAt:"2026-09-22T20:59:59.999Z",totalSeats:100,paidSeats:0,reservedSeats:0,remainingSeats:100,message:"نافذة المؤسسين متاحة الآن"};
const format=(value:string)=>new Intl.DateTimeFormat("ar-SA",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date(value));
const clock=(target:string,now:number)=>{const diff=Math.max(0,Date.parse(target)-now),days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000),minutes=Math.floor(diff%3600000/60000),seconds=Math.floor(diff%60000/1000);return {diff,days,hours,minutes,seconds}};

export default function FoundersLanding(){
  const [campaign,setCampaign]=useState<Campaign>(empty),[loaded,setLoaded]=useState(false),[now,setNow]=useState(()=>Date.now()),[honor,setHonor]=useState<FounderHonor|null>(null);
  useEffect(()=>{document.body.classList.add("founders-route");return()=>document.body.classList.remove("founders-route")},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch("/api/founders",{cache:"no-store"});if(response.ok&&active){setCampaign(await response.json() as Campaign);setLoaded(true)}}catch{if(active)setLoaded(true)}};void load();const timer=window.setInterval(()=>void load(),15000);return()=>{active=false;window.clearInterval(timer)}},[]);
  useEffect(()=>{let active=true;void fetch("/api/founders/honor",{cache:"no-store"}).then(response=>response.ok?response.json():null).then((value:FounderHonor|null)=>{if(active&&value?.available)setHonor(value)}).catch(()=>{});return()=>{active=false}},[]);
  const progress=Math.min(100,Math.max(0,(campaign.paidSeats/campaign.totalSeats)*100)),start=clock(campaign.startAt,now),end=clock(campaign.endAt,now),beforeStart=now<Date.parse(campaign.startAt),countdown=beforeStart?start:end;
  return <main className="founders-page" dir="rtl">
    <nav className="founders-nav"><Link href="/" className="founders-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span>NAVIXA <small>SA</small></span></Link><Link href="/plus">تعرف على Plus ←</Link></nav>
    <section className="founders-hero">
      <div className="founders-copy"><p className="founders-eyebrow">نافذة مؤسسي NAVIXA</p><h1>سعر مؤسس شخصي<br/><em>يظهر لك قبل الدفع.</em></h1><p className="founders-lead">يمكنك الانضمام إلى Plus أثناء التجربة أو بعدها. نافذة المؤسسين محدودة لأول 100 اشتراك مدفوع، ويخصص النظام سعرًا واحدًا لحسابك ويظهر لك بوضوح قبل أن تقرر الدفع.</p><div className="founders-actions"><Link href="/#account">ابدأ أو أكمل تجربتك</Link><Link className="direct-subscribe" href="/plus#plans">اشترك مباشرة</Link><a href="#terms">شروط العرض</a></div><p className="founders-choice">لك الخيار: أكمل التجربة حتى نهايتها، أو اشترك مباشرة في أي يوم منها عندما تكون مستعدًا.</p><p className="founders-date">الحملة: {format(campaign.startAt)} — {format(campaign.endAt)}</p></div>
      <aside className="seats-live" aria-live="polite"><span className="seats-label">{campaign.available?"المقاعد المتبقية الآن":"مقاعد حملة المؤسسين"}</span><strong>{loaded?campaign.remainingSeats:"—"}</strong><span className="seats-total">من أصل {campaign.totalSeats} مقعد</span><div className="seats-track"><i style={{width:`${progress}%`}}/></div><div className="campaign-clock"><span>{beforeStart?"تبدأ نافذة المؤسسين خلال":"ينتهي عرض المؤسسين خلال"}</span><b>{countdown.diff?`${countdown.days}ي ${String(countdown.hours).padStart(2,"0")}س ${String(countdown.minutes).padStart(2,"0")}د ${String(countdown.seconds).padStart(2,"0")}ث`:"انتهت الحملة"}</b></div><p>{campaign.available?"يُحدّث العداد كل 15 ثانية. لا ينقص المقعد إلا بعد دفع موثق.":"يمكنك الاشتراك المباشر في أي يوم من التجربة؛ سعر المؤسسين يبدأ بعد نهايتها."}</p></aside>
    </section>
    <section className="founders-principles"><article><b>1–12 ر.س</b><span>نطاق سعر المؤسس لأول شهر</span></article><article><b>15 دقيقة</b><span>مهلة حجز السعر للحساب</span></article><article><b>19 ر.س</b><span>سعر التجديد الشهري المعلن لاحقًا</span></article></section>
    <section className="founders-prices" aria-labelledby="founders-price-title"><div><small>أسعار الحملة</small><h2 id="founders-price-title">فئات سعر المؤسس</h2><p>يخصص النظام فئة واحدة لحسابك من المقاعد المتاحة. يظهر السعر النهائي قبل الدفع، ولا يعني ظهور الفئة أنها متاحة دائمًا.</p></div><div className="price-list" aria-label="فئات سعر أول شهر"><span className="special">1 ر.س<small>وفاء</small></span><span>3 ر.س</span><span>6 ر.س</span><span>9 ر.س</span><span>10 ر.س</span><span>12 ر.س</span></div></section>
    <section className="founders-explainer"><div><small>كيف يعمل العرض؟</small><h2>لا تختار السعر، لكنك ترى السعر كاملًا قبل الدفع.</h2></div><ol><li><b>سجّل ببريدك الموثق.</b><span>لكل حساب فرصة واحدة فقط.</span></li><li><b>يُخصص لك سعر مؤسس.</b><span>يُحجز لمدة 15 دقيقة ولا يعاد سحبه.</span></li><li><b>أكّد قرارك بحرية.</b><span>لا تُستهلك المقاعد إلا بعد دفع موثق.</span></li></ol></section>
    <section className="founders-trust"><div><span>✦</span><p><b>مفاجآت وفاء للمؤسسين.</b> تظهر امتيازاتها وفق شروط الحملة بعد تأكيد الاشتراك.</p></div><div><span>✓</span><p><b>لا بطاقة أثناء التجربة.</b> ولا يخصم أي مبلغ قبل اختيارك الاشتراك وإتمام الدفع.</p></div><div><span>✓</span><p><b>القرار لك.</b> تستطيع إدارة اشتراكك وفق السياسة المنشورة في حسابك.</p></div></section>
    {honor&&<section className="founder-honor" aria-live="polite"><span>✦</span><div><small>ميزة مؤسس NAVIXA</small><h2>{honor.title}</h2><p>{honor.message}</p><em>الشارة سارية حتى {honor.badgeUntil?format(honor.badgeUntil):""}</em></div></section>}
    <section className="founders-terms" id="terms"><small>شروط مختصرة قبل الدفع</small><h2>شفافية العرض جزء من التجربة.</h2><details><summary>عرض الشروط الأساسية</summary><p>حملة مؤسسي NAVIXA محدودة بـ100 اشتراك مدفوع موثق أو حتى نهاية الحملة، أيهما أولًا. سعر المؤسس يطبق على أول شهر فقط ويظهر للحساب قبل الدفع. السعر المعلن للتجديد لاحقًا هو 19 ر.س شهريًا. يخصص العرض مرة واحدة لكل حساب وبريد موثق، ولا يكتمل احتساب المقعد إلا بعد الدفع الناجح. تطبق سياسة الإلغاء والاسترجاع المنشورة وقت الشراء.</p></details><p className="terms-note">تُعرض التفاصيل الكاملة، والسعر النهائي، وسياسة الإلغاء قبل تأكيد أي دفع.</p></section>
    <footer>© NAVIXA SA · <Link href="/privacy">الخصوصية</Link> · <Link href="/plus">Plus</Link></footer>
  </main>;
}
