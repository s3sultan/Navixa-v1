"use client";

import {useEffect,useRef} from "react";
import {getPersonalReminderPrefs,PersonalReminderKind} from "./reminderPrefs";
import {readAcademicReminders} from "./academicReminders";

const MINUTE=60_000;
const ACTIVITY_KEY="navixa-last-activity-at";
const LAST_ANY_KEY="navixa-personal-reminder-last-any";
const sentKey=(kind:PersonalReminderKind)=>`navixa-personal-reminder-last-${kind}`;
const today=()=>new Date().toISOString().slice(0,10);

type Props={focusRunning:boolean;focusElapsedSeconds:number;onReminder:(message:string)=>void};
type Candidate={kind:PersonalReminderKind;title:string;body:string;due:boolean};

export default function PersonalReminderEngine({focusRunning,focusElapsedSeconds,onReminder}:Props){
  const callbackRef=useRef(onReminder);
  const focusRef=useRef({focusRunning,focusElapsedSeconds});
  useEffect(()=>{callbackRef.current=onReminder},[onReminder]);
  useEffect(()=>{focusRef.current={focusRunning,focusElapsedSeconds}},[focusRunning,focusElapsedSeconds]);

  useEffect(()=>{
    let lastStored=0;
    const recordActivity=()=>{
      const now=Date.now();
      if(now-lastStored<20_000)return;
      lastStored=now;
      localStorage.setItem(ACTIVITY_KEY,String(now));
    };
    if(!localStorage.getItem(ACTIVITY_KEY))recordActivity();
    const events:[keyof DocumentEventMap,AddEventListenerOptions|undefined][]=[["pointerdown",undefined],["keydown",undefined],["scroll",{passive:true}],["touchstart",{passive:true}]];
    events.forEach(([event,options])=>document.addEventListener(event,recordActivity,options));
    document.addEventListener("visibilitychange",recordActivity);

    const maybeRemind=()=>{
      if(document.visibilityState!=="visible")return;
      const prefs=getPersonalReminderPrefs();
      if(!prefs.enabled)return;
      const now=Date.now();
      const lastActivity=Number(localStorage.getItem(ACTIVITY_KEY)||now);
      const lastAny=Number(localStorage.getItem(LAST_ANY_KEY)||0);
      const quietFor=Math.max(15,prefs.quietMinutes)*MINUTE;
      if(now-lastAny<quietFor)return;

      const lastWaterIso=localStorage.getItem(`navixa-water-${today()}-last`);
      const lastWater=lastWaterIso?new Date(lastWaterIso).getTime():0;
      const waterInterval=Math.max(60,prefs.quietMinutes+40)*MINUTE;
      const activityAge=now-lastActivity;
      const activeToday=activityAge<2*60*MINUTE;
      if(!activeToday)return;

      const focus=focusRef.current;
      const academic=readAcademicReminders().find(item=>item.alertDate<=today()&&item.date>=today());
      const candidates:Candidate[]=[
        {kind:"eye",title:"راحة لعينيك",body:"خذ 20 ثانية وانظر إلى نقطة بعيدة. عيناك تستحقان الاستراحة.",due:prefs.eye&&((focus.focusRunning&&focus.focusElapsedSeconds>=20*60)||activityAge>=35*MINUTE)},
        {kind:"water",title:"تذكير ماء لطيف",body:"مر وقت منذ آخر كوب ماء مسجّل. خذ رشفة إذا احتجت.",due:prefs.water&&(!lastWater||now-lastWater>=waterInterval)},
        {kind:"break",title:"استراحة حركة قصيرة",body:"مضت فترة من دون تفاعل. حرّك كتفيك وخذ دقيقة خفيفة لنفسك.",due:prefs.break&&!focus.focusRunning&&activityAge>=55*MINUTE},
        {kind:"academic",title:"تذكير أكاديمي",body:academic?`غدًا أو اليوم: ${academic.title} (${academic.date}). راجع الموعد قبل البدء.`:"",due:Boolean(prefs.academic&&academic)},
      ];
      const next=candidates.find(candidate=>candidate.due&&now-Number(localStorage.getItem(sentKey(candidate.kind))||0)>=quietFor);
      if(!next)return;

      localStorage.setItem(LAST_ANY_KEY,String(now));
      localStorage.setItem(sentKey(next.kind),String(now));
      if(prefs.browser&&"Notification" in window&&Notification.permission==="granted")new Notification(next.title,{body:next.body,tag:`navixa-${next.kind}`});
      callbackRef.current(`${next.title} — ${next.body}`);
    };
    const timer=window.setInterval(maybeRemind,30_000);
    return()=>{window.clearInterval(timer);events.forEach(([event,options])=>document.removeEventListener(event,recordActivity,options));document.removeEventListener("visibilitychange",recordActivity)};
  },[]);

  return null;
}
