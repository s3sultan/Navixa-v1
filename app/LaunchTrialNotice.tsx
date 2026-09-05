"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {launchTrialPhase,launchTrialRemainingMs,LAUNCH_TRIAL_END} from "./launchTrial";

function remainingLabel(ms:number){
  const totalMinutes=Math.max(0,Math.floor(ms/60000));
  const days=Math.floor(totalMinutes/1440);
  const hours=Math.floor((totalMinutes%1440)/60);
  const minutes=totalMinutes%60;
  if(days>0)return `${days} يوم و${hours} ساعة`;
  if(hours>0)return `${hours} ساعة و${minutes} دقيقة`;
  return `${minutes} دقيقة`;
}

export default function LaunchTrialNotice(){
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const id=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(id)},[]);
  const phase=launchTrialPhase(now);
  const remaining=useMemo(()=>remainingLabel(launchTrialRemainingMs(now)),[now]);
  if(phase!=="reminder")return null;
  return <aside className="launch-trial-notice" dir="rtl" role="status" aria-live="polite">
    <div><strong>الفترة التجريبية المجانية مستمرة</strong><span>جرّب كامل NAVIXA حتى السبت 12 سبتمبر الساعة 4:00 م. متبقي {remaining}.</span></div>
    <div className="launch-trial-actions"><Link href="/plus">هِمّة · كامل NAVIXA</Link><Link href="/sprint">عَزْم · مراقبة الشاشة ونداء الاسم</Link></div>
    <time dateTime={LAUNCH_TRIAL_END}>تنتهي تلقائيًا الساعة 4:00 م بتوقيت السعودية</time>
  </aside>;
}
