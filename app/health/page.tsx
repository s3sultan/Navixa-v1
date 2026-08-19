"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import HealthMonitor from "../HealthMonitor";
import "../navixa.css";
import "../health-page.css";

export default function HealthPage(){
  const [alerts,setAlerts]=useState(()=>typeof window==="undefined"?true:localStorage.getItem("navixa-health-muted")!=="true");
  useEffect(()=>{localStorage.setItem("navixa-health-visited",new Date().toISOString().slice(0,10))},[]);
  const toggle=()=>{const next=!alerts;setAlerts(next);localStorage.setItem("navixa-health-muted",String(!next))};
  return <main className="health-page" dir="rtl">
    <header className="health-topbar">
      <Link className="health-back" href="/" aria-label="العودة إلى الرئيسية"><span>←</span> العودة للرئيسية</Link>
      <div className="health-identity"><span className="health-mark"><img src="/navixa-mark.png" alt="" /></span><div><small>NAVIXA HEALTH</small><h1>مركز صحتي</h1><p>مساحة هادئة لجسم أكثر توازنًا ويوم أكثر نشاطًا.</p></div></div>
      <button className={`health-alert-toggle ${alerts?"enabled":"muted"}`} onClick={toggle} aria-label="تفعيل أو إلغاء تنبيهات الصحة"><span>{alerts?"🔔":"🔕"}</span><b>{alerts?"التنبيهات مفعّلة":"التنبيهات متوقفة"}</b></button>
    </header>
    <section className="health-hero" aria-labelledby="health-hero-title"><div className="health-hero-copy"><small>صحة NAVIXA · محليًا وخصوصيًا</small><h2 id="health-hero-title">اجلس بوعي، وتحرك في وقتك</h2><p>راقب وضعية جلوسك، سجّل ماءك، وخذ استراحة قصيرة عندما يحتاجها جسدك — بدون رفع صور الكاميرا إلى أي خادم.</p><div className="health-hero-pills"><span>خصوصية أولًا</span><span>مراقبة محلية</span><span>خطوات بسيطة</span></div></div><div className="health-hero-orb"><img src="/navixa-mark.png" alt="" /><span>جسمك<br/><b>يستحق العناية</b></span></div></section>
    <HealthMonitor/>
    <section className="health-ecosystem-teaser" aria-label="منظومة NAVIXA القادمة">
      <div className="health-ecosystem-icon" aria-hidden="true">◒</div>
      <div className="health-ecosystem-copy"><small>من منظومة NAVIXA</small><h2>NAVIXA Fitness</h2><p>مساحة رياضية هادئة تساعدك على بناء عادات حركة متوازنة.</p></div>
      <span className="health-coming-soon">قريبًا</span>
    </section>
  </main>
}
