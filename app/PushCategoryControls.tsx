"use client";

import {useEffect,useState} from "react";
import {ensureNavixaPushSubscription} from "./pushClient";
import {readSharedPrayerLocation} from "./prayerLocationModel";
import {readAdjustments} from "./prayerTimeModel";

type Category="adhan"|"schedule";
type Preference={category:Category;enabled:boolean;snoozedUntil:string};
const LABELS:Record<Category,{title:string;detail:string}>={
  adhan:{title:"Push الأذان",detail:"ينبهك عند دخول وقت الصلاة حسب موقع الصلاة المحفوظ في NAVIXA."},
  schedule:{title:"Push الجدول",detail:"ينبهك عند وقت المواعيد والاجتماعات والاختبارات التي تضيفها إلى يومي."},
};
const defaults:Record<Category,Preference>={adhan:{category:"adhan",enabled:false,snoozedUntil:""},schedule:{category:"schedule",enabled:false,snoozedUntil:""}};

export default function PushCategoryControls(){
  const [prefs,setPrefs]=useState<Record<Category,Preference>>(defaults);
  const [busy,setBusy]=useState<Category|null>(null);
  const [notice,setNotice]=useState("");
  const load=async()=>{const response=await fetch("/api/push/preferences",{cache:"no-store",credentials:"same-origin"});if(!response.ok)return;const data=await response.json().catch(()=>({})) as {preferences?:Preference[]};const next={...defaults};for(const item of data.preferences||[]){if(item.category==="adhan"||item.category==="schedule")next[item.category]=item}setPrefs(next)};
  useEffect(()=>{void load()},[]);

  const syncPrayerLocation=async()=>{
    const location=readSharedPrayerLocation();
    if(!location)throw new Error("حدّد موقع الصلاة أولًا من مركز العبادة قبل تفعيل Push الأذان.");
    const body=location.mode==="city"?{mode:"city",city:location.city,country:location.country,label:location.label,adjustments:readAdjustments()}:{mode:"coords",lat:location.lat,lng:location.lng,label:location.label,adjustments:readAdjustments()};
    const response=await fetch("/api/prayer-alerts/settings",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
    if(!response.ok){const data=await response.json().catch(()=>({})) as {error?:string};throw new Error(data.error||"تعذر حفظ موقع الصلاة.")}
  };
  const save=async(category:Category,enabled:boolean,snoozeMinutes=0,resume=false)=>{
    setBusy(category);setNotice("");
    try{
      if(enabled){
        const subscription=await ensureNavixaPushSubscription({requestPermission:true});
        if(!subscription)throw new Error("فعّل Push على الجهاز أولًا.");
        if(category==="adhan")await syncPrayerLocation();
      }
      const response=await fetch("/api/push/preferences",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({category,enabled,snoozeMinutes,resume})});
      const data=await response.json().catch(()=>({})) as {error?:string;preference?:Preference};
      if(!response.ok)throw new Error(data.error||"تعذر حفظ إعداد Push.");
      if(data.preference)setPrefs(current=>({...current,[category]:data.preference!}));
      setNotice(snoozeMinutes?`تم إيقاف ${LABELS[category].title} مؤقتًا`:`تم تحديث ${LABELS[category].title}`);
    }catch(error){setNotice(error instanceof Error?error.message:"تعذر تحديث Push")}
    finally{setBusy(null)}
  };
  const snoozed=(preference:Preference)=>Boolean(preference.snoozedUntil&&Date.parse(preference.snoozedUntil)>Date.now());
  const formatUntil=(value:string)=>new Intl.DateTimeFormat("ar-SA",{hour:"numeric",minute:"2-digit",day:"numeric",month:"short"}).format(new Date(value));

  return <section className="personal-reminder-settings" aria-labelledby="push-category-title"><div className="personal-reminder-heading"><div><small>Push باختيارك</small><h3 id="push-category-title">الأذان والجدول تحت تحكمك</h3><p>التفعيل والإيقاف والغفوة محفوظة على حسابك، وتُحترم حتى عندما يكون NAVIXA مغلقًا.</p></div></div><div className="alert-prefs-list">{(["adhan","schedule"] as Category[]).map(category=>{const preference=prefs[category],paused=snoozed(preference);return <div className="alert-prefs-row" key={category}><div><b>{LABELS[category].title}</b><small>{LABELS[category].detail}</small>{paused&&<em>متوقف مؤقتًا حتى {formatUntil(preference.snoozedUntil)}</em>}</div><button type="button" disabled={busy===category} onClick={()=>void save(category,!preference.enabled)}>{busy===category?"جارٍ الحفظ…":preference.enabled?"إيقاف":"تفعيل"}</button>{preference.enabled&&!paused&&<select aria-label={`غفوة ${LABELS[category].title}`} defaultValue="" onChange={event=>{const minutes=Number(event.target.value);if(minutes)void save(category,true,minutes);event.currentTarget.value=""}}><option value="">غفوة مؤقتة</option><option value="60">ساعة</option><option value="180">3 ساعات</option><option value="720">12 ساعة</option><option value="1440">24 ساعة</option></select>}{preference.enabled&&paused&&<button type="button" disabled={busy===category} onClick={()=>void save(category,true,0,true)}>استئناف الآن</button>}</div>})}</div>{notice&&<p className="channel-status" role="status">{notice}</p>}</section>;
}
