"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {LAUNCH_TRIAL_END} from "./launchTrial";
import {LAUNCH_TRIAL_COPY} from "./launchTrialCopy";

type TrialStatus={active:boolean;phase:string;remainingMs:number};
function remainingLabel(ms:number){const totalMinutes=Math.max(0,Math.floor(ms/60000));const days=Math.floor(totalMinutes/1440);const hours=Math.floor((totalMinutes%1440)/60);const minutes=totalMinutes%60;if(days>0)return `${days} يوم و${hours} ساعة`;if(hours>0)return `${hours} ساعة و${minutes} دقيقة`;return `${minutes} دقيقة`;}

export default function LaunchTrialNotice(){
  const [status,setStatus]=useState<TrialStatus|null>(null);
  useEffect(()=>{let live=true;const sync=()=>fetch("/api/access/trial",{cache:"no-store",credentials:"same-origin"}).then(async r=>r.ok?r.json():null).then(data=>{if(live&&data)setStatus(data)}).catch(()=>{});sync();const id=window.setInterval(sync,30000);window.addEventListener("pageshow",sync);return()=>{live=false;window.clearInterval(id);window.removeEventListener("pageshow",sync)};},[]);
  if(status?.phase!=="reminder")return null;
  return <aside className="launch-trial-notice" dir="rtl" role="status" aria-live="polite">
    <div><strong>{LAUNCH_TRIAL_COPY.title}</strong><span>{LAUNCH_TRIAL_COPY.body} متبقي {remainingLabel(status.remainingMs)}.</span></div>
    <div className="launch-trial-actions"><Link href="/plus">{LAUNCH_TRIAL_COPY.himma}</Link><Link href="/sprint">{LAUNCH_TRIAL_COPY.azm}</Link></div>
    <time dateTime={LAUNCH_TRIAL_END}>{LAUNCH_TRIAL_COPY.endNote}</time>
  </aside>;
}
