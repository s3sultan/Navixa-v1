"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {LAUNCH_TRIAL_END} from "./launchTrial";

type TrialStatus={active:boolean;phase:string;remainingMs:number};
function remainingLabel(ms:number){const totalMinutes=Math.max(0,Math.floor(ms/60000));const days=Math.floor(totalMinutes/1440);const hours=Math.floor((totalMinutes%1440)/60);const minutes=totalMinutes%60;if(days>0)return `${days} يوم و${hours} ساعة`;if(hours>0)return `${hours} ساعة و${minutes} دقيقة`;return `${minutes} دقيقة`;}

export default function LaunchTrialNotice(){
  const [status,setStatus]=useState<TrialStatus|null>(null);
  useEffect(()=>{
    let live=true;
    const sync=()=>fetch("/api/access/trial",{cache:"no-store",credentials:"same-origin"}).then(async r=>r.ok?r.json():null).then(data=>{if(live&&data)setStatus(data)}).catch(()=>{});
    sync();const id=window.setInterval(sync,30000);window.addEventListener("pageshow",sync);
    return()=>{live=false;window.clearInterval(id);window.removeEventListener("pageshow",sync)};
  },[]);
  if(status?.phase!=="reminder")return null;
  return <aside className="launch-trial-notice" dir="rtl" role="status" aria-live="polite">
    <div><strong>الفترة التجريبية المجانية مستمرة</strong><span>جرّب كامل NAVIXA حتى السبت 12 سبتمبر الساعة 4:00 م. متبقي {remainingLabel(status.remainingMs)}.</span></div>
    <div className="launch-trial-actions"><Link href="/plus">هِمّة · كامل NAVIXA</Link><Link href="/sprint">عَزْم · مراقبة الشاشة ونداء الاسم</Link></div>
    <time dateTime={LAUNCH_TRIAL_END}>تنتهي تلقائيًا الساعة 4:00 م بتوقيت السعودية</time>
  </aside>;
}
