"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import { useEffect, useState } from "react";

type Campaign={
  available:boolean;startAt:string;endAt:string;message:string;
};
type FounderHonor={found:boolean;available:boolean;badgeUntil?:string;title?:string;message?:string};

const empty:Campaign={available:false,startAt:"2026-08-21T21:00:00.000Z",endAt:"2026-09-22T20:59:59.999Z",message:"عرض مؤسسي NAVIXA متاح الآن"};
const format=(value:string)=>new Intl.DateTimeFormat("ar-SA",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date(value));
const clock=(target:string,now:number)=>{const diff=Math.max(0,Date.parse(target)-now),days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000),minutes=Math.floor(diff%3600000/60000),seconds=Math.floor(diff%60000/1000);return {diff,days,hours,minutes,seconds}};

export default function FoundersLanding(){
  const router=useRouter();
  const [campaign,setCampaign]=useState<Campaign>(empty),[loaded,setLoaded]=useState(false),[now,setNow]=useState(()=>Date.now()),[honor,setHonor]=useState<FounderHonor|null>(null),[offerBusy,setOfferBusy]=useState(false),[offerNotice,setOfferNotice]=useState("");
  useEffect(()=>{document.body.classList.add("founders-route");return()=>document.body.classList.remove("founders-route")},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch("/api/founders",{cache:"no-store"});if(response.ok&&active){setCampaign(await response.json() as Campaign);setLoaded(true)}}catch{if(active)setLoaded(true)}};void load();const timer=window.setInterval(()=>void load(),15000);return()=>{active=false;window.clearInterval(timer)}},[]);
  useEffect(()=>{let active=true;void fetch("/api/founders/honor",{cache:"no-store"}).then(response=>response.ok?response.json():null).then((value:FounderHonor|null)=>{if(active&&value?.available)setHonor(value)}).catch(()=>{});return()=>{active=false}},[]);
  const reserveOffer=async()=>{setOfferBusy(true);setOfferNotice("");try{const response=await fetch("/api/founders",{method:"POST",headers:{"Content-Type":"application/json"}}),data=await response.json().catch(()=>({}));if(!response.ok){setOfferNotice(data.error||"تعذر تجهيز سعر المؤسس الآن");return;}router.push(`/plus?founders_intent=${encodeURIComponent(data.foundersIntentId)}#checkout`);}catch{setOfferNotice("تعذر الاتصال بحملة المؤسسين الآن. حاول لاحقًا.");}finally{setOfferBusy(false);}};
  const start=clock(campaign.startAt,now),end=clock(campaign.endAt,now),beforeStart=now<Date.parse(campaign.startAt),countdown=beforeStart?start:end;
  return <main className="founders-page" dir="rtl">
    <nav className="founders-nav"><Link href="/" className="founders-brand" aria-label="العودة إلى NAVIXA"><img src="/navixa-mark.webp" alt=""/><span>NAVIXA <small>SA</small></span></Link><Link href="/plus">تعرف على Plus ←</Link></nav>
    <section className="founders-hero">
      <div className="founders-copy"><p className="founders-eyebrow">نافذة مؤسسي NAVIXA</p><h1>سعر مؤسس شخصي<br/><em>يظهر لك قبل الدفع.</em></h1><p className="founders-lead">يمكنك الانضمام إلى Plus أثناء التجربة أو بعدها. يخصص النظام سعرًا خاصًا واحدًا لحسابك ويظهر لك بوضوح قبل أن تقرر الدفع.</p><div className="founders-actions"><Link href="/#account">ابدأ أو أكمل تجربتك</Link><button className="direct-subscribe" disabled={offerBusy} onClick={()=>void reserveOffer()}>{offerBusy?"جارٍ تخصيص السعر…":"اكتشف سعر المؤسس"}</button><a href="#terms">شروط العرض</a></div>{offerNotice&&<p className="founders-offer-notice" role="status">{offerNotice}</p>}<p className="founders-choice">لك الخيار: أكمل التجربة حتى نهايتها، أو اشترك مباشرة في أي يوم منها عندما تكون مستعدًا.</p><p className="founders-date">الحملة: {format(campaign.startAt)} — {format(campaign.endAt)}</p></div>
      <aside className="seats-live" aria-live="polite"><span className="seats-label">{campaign.available?"عرض مؤسسي NAVIXA متاح الآن":"عرض مؤسسي NAVIXA"}</span><strong>{loaded&&campaign.available?"سعر خاص":"—"}</strong><span className="seats-total">يظهر المبلغ النهائي لحسابك قبل الدفع</span><div className="campaign-clock"><span>{beforeStart?"تبدأ نافذة المؤسسين خلال":"ينتهي عرض المؤسسين خلال"}</span><b>{countdown.diff?`${countdown.days}ي ${String(countdown.hours).padStart(2,"0")}س ${String(countdown.minutes).padStart(2,"0")}د ${String(countdown.seconds).padStart(2,"0")}ث`:"انتهت الحملة"}</b></div><p>{campaign.available?"العرض مخصص للحساب بعد التحقق، ولا يظهر السعر إلا قبل الدفع.":"يمكنك الاشتراك المباشر في أي يوم من التجربة."}</p></aside>
    </section>
    <section className="founders-principles"><article><b>سعر ترحيبي</b><span>يظهر لك للشهر الأول قبل الدفع</span></article><article><b>15 دقيقة</b><span>مهلة هادئة لتراجع السعر المخصص لك</span></article><article><b>19 ر.س</b><span>السعر الشهري الواضح بعد الشهر الأول</span></article></section>
    <section className="founders-prices" aria-labelledby="founders-price-title"><div><small>سعر ترحيبي لك</small><h2 id="founders-price-title">فئات عرض المؤسسين</h2><p>يخصص النظام لحسابك سعرًا ترحيبيًا واحدًا للشهر الأول. ترى السعر النهائي وتفاصيل التجديد بوضوح قبل الدفع، ثم تختار بكامل راحتك.</p></div><div className="price-list" aria-label="فئات السعر الترحيبي للشهر الأول"><span className="special"><b>1</b><em>ر.س</em><small>وفاء</small></span><span><b>3</b><em>ر.س</em></span><span><b>6</b><em>ر.س</em></span><span><b>9</b><em>ر.س</em></span><span><b>10</b><em>ر.س</em></span><span><b>12</b><em>ر.س</em></span></div></section>
    <section className="founders-explainer"><div><small>كيف يعمل العرض؟</small><h2>سعر واضح لك، ثم قرارك براحتك.</h2></div><ol><li><div><small>01</small><b>سجّل ببريدك الموثق.</b><span>لكل حساب فرصة واحدة فقط.</span></div></li><li><div><small>02</small><b>يُخصص لك سعر ترحيبي.</b><span>تراجعه بهدوء لمدة 15 دقيقة، ولا يتغير عليك.</span></div></li><li><div><small>03</small><b>اختر ما يناسبك.</b><span>ترى كل التفاصيل قبل الدفع، ولا يثبت شيء إلا بعد دفع موثق.</span></div></li></ol></section>
    <section className="founders-trust"><div><span>✦</span><p><b>مفاجآت وفاء للمؤسسين.</b> تظهر امتيازاتها وفق شروط الحملة بعد تأكيد الاشتراك.</p></div><div><span>✓</span><p><b>لا بطاقة أثناء التجربة.</b> ولا يخصم أي مبلغ قبل اختيارك الاشتراك وإتمام الدفع.</p></div><div><span>✓</span><p><b>القرار لك.</b> تستطيع إدارة اشتراكك وفق السياسة المنشورة في حسابك.</p></div></section>
    {honor&&<section className="founder-honor" aria-live="polite"><span>✦</span><div><small>ميزة مؤسس NAVIXA</small><h2>{honor.title}</h2><p>{honor.message}</p><em>الشارة سارية حتى {honor.badgeUntil?format(honor.badgeUntil):""}</em></div></section>}
    <section className="founders-terms" id="terms"><small>شروط مختصرة قبل الدفع</small><h2>شفافية العرض جزء من التجربة.</h2><details><summary>عرض الشروط الأساسية</summary><p>عرض مؤسسي NAVIXA متاح خلال فترة الحملة وبحسب شروطها الداخلية. يطبق السعر الترحيبي المخصص على الشهر الأول ويظهر للحساب قبل الدفع. بعد ذلك يستمر Plus بالسعر الشهري المعلن وهو 19 ر.س، وتظهر تفاصيل التجديد وإدارة الاشتراك كاملة قبل تأكيد أي دفع. يخصص العرض مرة واحدة لكل حساب وبريد موثق، ولا يكتمل احتساب العرض إلا بعد الدفع الناجح. تطبق سياسة الإلغاء والاسترجاع المنشورة وقت الشراء.</p></details><p className="terms-note">تُعرض التفاصيل الكاملة، والسعر النهائي، وسياسة الإلغاء قبل تأكيد أي دفع.</p></section>
    <footer>© NAVIXA SA · <Link href="/privacy">الخصوصية</Link> · <Link href="/plus">Plus</Link></footer>
  </main>;
}
