"use client";

import {useEffect,useRef,useState} from "react";
import {dismissPersonalReminder,getPersonalReminderPrefs,isPersonalReminderMuted,PersonalReminderKind} from "./reminderPrefs";
import {readAcademicReminders} from "./academicReminders";
import {isScreenEnabled} from "./alertPrefs";

const MINUTE=60_000;
const ACTIVITY_KEY="navixa-last-activity-at";
const LAST_ANY_KEY="navixa-personal-reminder-last-any";
const sentKey=(kind:PersonalReminderKind)=>`navixa-personal-reminder-last-${kind}`;
const today=()=>new Date().toISOString().slice(0,10);

type Props={focusRunning:boolean;focusElapsedSeconds:number;onReminder?:(message:string)=>void};
type Candidate={kind:PersonalReminderKind;title:string;body:string;due:boolean};

export default function PersonalReminderEngine({focusRunning,focusElapsedSeconds}:Props){
  const focusRef=useRef({focusRunning,focusElapsedSeconds});
  const [visible,setVisible]=useState<Candidate|null>(null);
  const [notice,setNotice]=useState("");
  useEffect(()=>{focusRef.current={focusRunning,focusElapsedSeconds}},[focusRunning,focusElapsedSeconds]);

  const closeReminder=()=>{if(!visible)return;const result=dismissPersonalReminder(visible.kind);setVisible(null);if(result.muted){setNotice(`تم إيقاف ${visible.title}. يمكنك إعادته من إعدادات التنبيهات.`);window.setTimeout(()=>setNotice(""),4200)}};

  useEffect(()=>{
    let lastStored=0;
    const recordActivity=()=>{const now=Date.now();if(now-lastStored<20_000)return;lastStored=now;localStorage.setItem(ACTIVITY_KEY,String(now))};
    if(!localStorage.getItem(ACTIVITY_KEY))recordActivity();
    const events:[keyof DocumentEventMap,AddEventListenerOptions|undefined][]=[["pointerdown",undefined],["keydown",undefined],["scroll",{passive:true}],["touchstart",{passive:true}]];
    events.forEach(([event,options])=>document.addEventListener(event,recordActivity,options));
    document.addEventListener("visibilitychange",recordActivity);

    const maybeRemind=()=>{
      if(document.visibilityState!=="visible"||visible)return;
      const prefs=getPersonalReminderPrefs();if(!prefs.enabled)return;
      const now=Date.now(),lastActivity=Number(localStorage.getItem(ACTIVITY_KEY)||now),lastAny=Number(localStorage.getItem(LAST_ANY_KEY)||0),quietFor=Math.max(15,prefs.quietMinutes)*MINUTE;
      if(now-lastAny<quietFor)return;
      const lastWaterIso=localStorage.getItem(`navixa-water-${today()}-last`),lastWater=lastWaterIso?new Date(lastWaterIso).getTime():0,waterInterval=Math.max(60,prefs.quietMinutes+40)*MINUTE,activityAge=now-lastActivity;
      if(activityAge>=2*60*MINUTE)return;
      const focus=focusRef.current,academic=readAcademicReminders().find(item=>item.alertDate<=today()&&item.date>=today());
      const candidates:Candidate[]=[
        {kind:"eye",title:"راحة لعينيك",body:"خذ 20 ثانية وانظر إلى نقطة بعيدة. عيناك تستحقان الاستراحة.",due:prefs.eye&&isScreenEnabled("break")&&((focus.focusRunning&&focus.focusElapsedSeconds>=20*60)||activityAge>=35*MINUTE)},
        {kind:"water",title:"تذكير ماء لطيف",body:"مر وقت منذ آخر كوب ماء مسجّل. خذ رشفة إذا احتجت.",due:prefs.water&&isScreenEnabled("water")&&(!lastWater||now-lastWater>=waterInterval)},
        {kind:"break",title:"استراحة حركة قصيرة",body:"مضت فترة من دون تفاعل. حرّك كتفيك وخذ دقيقة خفيفة لنفسك.",due:prefs.break&&isScreenEnabled("break")&&!focus.focusRunning&&activityAge>=55*MINUTE},
        {kind:"academic",title:"تذكير أكاديمي",body:academic?`غدًا أو اليوم: ${academic.title} (${academic.date}). راجع الموعد قبل البدء.`:"",due:Boolean(prefs.academic&&academic)},
      ];
      const next=candidates.find(candidate=>candidate.due&&!isPersonalReminderMuted(candidate.kind)&&now-Number(localStorage.getItem(sentKey(candidate.kind))||0)>=quietFor);if(!next)return;
      localStorage.setItem(LAST_ANY_KEY,String(now));localStorage.setItem(sentKey(next.kind),String(now));
      if(prefs.browser&&"Notification" in window&&Notification.permission==="granted")new Notification(next.title,{body:next.body,tag:`navixa-${next.kind}`});
      setVisible(next);
    };
    const timer=window.setInterval(maybeRemind,30_000);
    return()=>{window.clearInterval(timer);events.forEach(([event,options])=>document.removeEventListener(event,recordActivity,options));document.removeEventListener("visibilitychange",recordActivity)};
  },[visible]);

  return <>{visible&&<div dir="rtl" role="status" style={{position:"fixed",zIndex:10000,top:"max(14px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",width:"min(92vw,760px)",background:"linear-gradient(120deg,#079b95,#123f5a)",color:"white",padding:"16px 52px 16px 18px",borderRadius:18,boxShadow:"0 14px 35px rgba(14,63,76,.22)",fontWeight:700,lineHeight:1.7}}><button type="button" aria-label="إغلاق التنبيه" onClick={closeReminder} style={{position:"absolute",right:12,top:10,border:0,background:"rgba(255,255,255,.16)",color:"white",width:32,height:32,borderRadius:10,fontSize:24,cursor:"pointer"}}>×</button><span>✓ {visible.title} — {visible.body}</span></div>}{notice&&<div dir="rtl" role="status" style={{position:"fixed",zIndex:10001,bottom:22,left:"50%",transform:"translateX(-50%)",width:"min(90vw,620px)",background:"#173f4b",color:"white",padding:"13px 16px",borderRadius:14,textAlign:"center",fontWeight:700}}>{notice}</div>}</>;
}
